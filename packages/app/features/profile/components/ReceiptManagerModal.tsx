import { useState, useEffect, useRef } from 'react'
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal as RNModal,
  Linking,
  TextInput,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Label } from 'app/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'app/components/ui/alert-dialog'
import { ImageGallery, ImageItem } from 'app/components/gallery/ImageGallery'
import { ReceiptThumbnail } from './ReceiptThumbnail'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from 'app/components/ui/collapsible'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import {
  useContestReceipts,
  useReceiptStats,
  useUploadReceipt,
  useUpdateReceipt,
  useDeleteReceipt,
  useReceiptSignedUrls,
} from 'app/hooks/useReceipts'
import { BACKEND } from 'app/lib/backend'
import { useSubscription } from 'app/contexts/SubscriptionContext'
import {
  pickImages,
  pickDocument,
  validateFileSize,
  validateFileType,
  isImageFile,
} from 'app/utils/filePicker'
import { toast } from 'app/lib/sonner-universal'
import { useAuth } from 'app/contexts/AuthContext'
import { useTextScale } from 'app/contexts/TextScaleContext'
import { account } from 'app/provider/appwrite/api'
import { TURNSTILE_SITE_KEY } from 'app/utils/constants/ConstTurnstile'
import { TurnstileWidget } from 'app/components/TurnstileWidget'
import { type Receipt } from 'app/lib/receipts/api'
import { useColorScheme } from 'app/hooks/useColorScheme'
import Colors from 'app/utils/constants/ConstColors'
import { cn } from 'app/lib/utils'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import { ChevronDoubleDownOutline } from 'app/components/icons-svg/ChevronDoubleDownOutline'
import { ChevronDoubleUpOutline } from 'app/components/icons-svg/ChevronDoubleUpOutline'
import { PlusOutline } from 'app/components/icons-svg/PlusOutline'
import { DocumentScanner } from 'app/components/DocumentScanner'

interface ReceiptManagerModalProps {
  visible: boolean
  contestId: string
  contestTitle: string
  onClose: () => void
}

export default function ReceiptManagerModal({
  visible,
  contestId,
  contestTitle,
  onClose,
}: ReceiptManagerModalProps) {
  const { t } = useLingui()
  const { user } = useAuth()
  const { isDarkColorScheme, colorScheme } = useColorScheme()
  const { fontSize } = useTextScale()

  // State
  const [jwt, setJwt] = useState<string | null>(null)
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null)

  // Upload notes state (optional notes before uploading)
  const [uploadNotes, setUploadNotes] = useState('')

  // CAPTCHA state for upload protection
  const [captchaToken, setCaptchaToken] = useState('')
  const [isCaptchaReady, setIsCaptchaReady] = useState(false)
  // Bumped after each upload attempt to force the Turnstile widget to mint a
  // fresh single-use token (otherwise retries replay a consumed token -> 403).
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)

  // Collapsible state for "Add New Receipt" section
  const [addReceiptOpen, setAddReceiptOpen] = useState(false)

  // Track which upload type is in progress
  const [uploadingType, setUploadingType] = useState<
    'image' | 'pdf' | 'scan' | null
  >(null)

  // ScrollView ref for auto-scroll (native)
  const scrollViewRef = useRef<ScrollView | null>(null)

  // Document scanner state (web only)
  const [scannerVisible, setScannerVisible] = useState(false)

  // Queries
  const {
    data: receipts = [],
    isLoading: isLoadingReceipts,
    refetch: refetchReceipts,
  } = useContestReceipts(contestId)
  const { data: stats, refetch: refetchStats } = useReceiptStats()

  // Displayable URLs (Supabase: batched signed URLs; Appwrite: file view URLs).
  const { data: fileUrls = {}, error: fileUrlsError } =
    useReceiptSignedUrls(receipts)

  // Surface signed-URL failures instead of silently showing blank thumbnails.
  useEffect(() => {
    if (fileUrlsError) {
      toast.error(
        t`Couldn't load receipt previews. Please try reopening this contest.`
      )
    }
  }, [fileUrlsError, t])

  // Get subscription limits (server-side source of truth)
  const { features } = useSubscription()

  // Mutations
  const uploadMutation = useUploadReceipt()
  const updateMutation = useUpdateReceipt()
  const deleteMutation = useDeleteReceipt()

  // Get query client for manual invalidation
  const queryClient = useQueryClient()

  // Refetch data when modal becomes visible to ensure limits are up-to-date
  useEffect(() => {
    if (visible) {
      refetchReceipts()
      refetchStats()
    }
  }, [visible, refetchReceipts, refetchStats])

  // Get limits from subscription tier (matches server-side validation)
  const maxContests = features.maxContestsWithReceipts
  const maxReceipts = features.maxReceiptsPerContest

  // Check if at limits (handle unlimited with -1)
  const contestCount = stats?.totalContestsWithReceipts || 0
  const receiptCount = receipts.length

  const isContestLimitUnlimited = maxContests === -1
  const isReceiptLimitUnlimited = maxReceipts === -1

  // Reset CAPTCHA when theme changes (widget will re-mount)
  useEffect(() => {
    if (addReceiptOpen) {
      // Only reset if collapsible is open (CAPTCHA is visible)
      setCaptchaToken('')
      setIsCaptchaReady(false)
    }
  }, [colorScheme])
  const isNewContest = !stats?.contestsWithReceipts.includes(contestId)
  const atContestLimit =
    !isContestLimitUnlimited && isNewContest && contestCount >= maxContests
  const atReceiptLimit = !isReceiptLimitUnlimited && receiptCount >= maxReceipts

  // Get JWT for Android (Appwrite private-image auth only; Supabase uses signed URLs).
  useEffect(() => {
    if (Platform.OS === 'android' && user && BACKEND === 'appwrite') {
      const fetchJWT = async () => {
        try {
          const { jwt } = await account.createJWT()
          setJwt(jwt)
        } catch (error) {
          console.error('Failed to create JWT:', error)
        }
      }
      fetchJWT()
    }
  }, [user])

  // Collapsible starts collapsed by default

  // Lock body scroll on web when modal is visible (especially for iOS Safari)
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY

      // Prevent scrolling with iOS Safari fix
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      // Restore original styles when modal closes
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [visible])

  // Handle file selection
  const handleAddReceipt = async (type: 'image' | 'pdf') => {
    // Note: CAPTCHA check is now handled by button disabled state

    // Check limits
    if (atContestLimit) {
      toast.error(
        t`You've reached the limit of ${maxContests} contests with receipts. Upgrade to Pro for unlimited contests.`
      )
      return
    }

    if (atReceiptLimit) {
      toast.error(
        t`Maximum ${maxReceipts} receipts per contest. Upgrade to Pro for more receipts.`
      )
      return
    }

    // Pick file
    const result = type === 'image' ? await pickImages() : await pickDocument()

    if (!result.success || !result.file) {
      if (result.error) {
        toast.error(result.error)
      }
      return
    }

    const file = result.file

    // Validate file
    const sizeValidation = validateFileSize(file)
    if (!sizeValidation.valid) {
      toast.error(sizeValidation.error || t`File size too large`)
      return
    }

    const typeValidation = validateFileType(file)
    if (!typeValidation.valid) {
      toast.error(typeValidation.error || t`Invalid file type`)
      return
    }

    // Upload
    setUploadingType(type)
    try {
      await uploadMutation.mutateAsync({
        contestId,
        file: file as any,
        notes: uploadNotes.trim() || '', // Use trimmed notes or empty string
        fileOrder: receiptCount,
        fileType: file.type,
        captchaToken,
      })

      toast.success(t`Receipt uploaded successfully`)

      // Reset state after successful upload
      setCaptchaToken('')
      setUploadNotes('') // Clear upload notes
      setAddReceiptOpen(false) // Collapse the section
      // Don't set isCaptchaReady here - let the widget signal when it's ready again
    } catch (error) {
      console.error('Upload error:', error)

      // Check if error is related to sanitization
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('Invalid content')) {
        toast.error(
          t`Invalid content detected in notes. Please remove any HTML tags or special characters.`
        )
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : t`Failed to upload receipt. Please try again.`
        )
      }
    } finally {
      setUploadingType(null)
      // Re-arm CAPTCHA after every attempt — Turnstile tokens are single-use, so
      // the next upload (whether this one succeeded or failed) needs a fresh one.
      setCaptchaToken('')
      setIsCaptchaReady(false)
      setCaptchaResetSignal((n) => n + 1)
    }
  }

  // Handle scanned document (web only)
  const handleScannedDocument = async (file: File) => {
    // Note: CAPTCHA check is now handled by button disabled state

    // Check limits
    if (atContestLimit) {
      toast.error(
        t`You've reached the limit of ${maxContests} contests with receipts. Upgrade to Pro for unlimited contests.`
      )
      return
    }

    if (atReceiptLimit) {
      toast.error(
        t`Maximum ${maxReceipts} receipts per contest. Upgrade to Pro for more receipts.`
      )
      return
    }

    // Upload the scanned document
    setUploadingType('scan')
    try {
      await uploadMutation.mutateAsync({
        contestId,
        file: file as any,
        notes: uploadNotes.trim() || '',
        fileOrder: receiptCount,
        fileType: file.type,
        captchaToken,
      })

      toast.success(t`Scanned receipt uploaded successfully`)

      // Reset state after successful upload
      setCaptchaToken('')
      setUploadNotes('')
      setAddReceiptOpen(false)
    } catch (error) {
      console.error('Upload error:', error)

      // Check if error is related to sanitization
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('Invalid content')) {
        toast.error(
          t`Invalid content detected in notes. Please remove any HTML tags or special characters.`
        )
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : t`Failed to upload scanned receipt. Please try again.`
        )
      }
    } finally {
      setUploadingType(null)
      // Re-arm CAPTCHA after every attempt — Turnstile tokens are single-use, so
      // the next upload (whether this one succeeded or failed) needs a fresh one.
      setCaptchaToken('')
      setIsCaptchaReady(false)
      setCaptchaResetSignal((n) => n + 1)
    }
  }

  // Handle edit start (toggle if clicking on same receipt)
  const handleEditStart = (receipt: Receipt) => {
    if (editingReceipt?.$id === receipt.$id) {
      // If clicking on the same receipt, cancel editing
      setEditingReceipt(null)
      setEditNotes('')
    } else {
      // Start editing this receipt
      setEditingReceipt(receipt)
      setEditNotes(receipt.notes)
    }
  }

  // Handle edit save
  const handleEditSave = async () => {
    if (!editingReceipt) return

    try {
      await updateMutation.mutateAsync({
        receiptId: editingReceipt.$id,
        contestId,
        notes: editNotes,
      })

      toast.success(t`Notes updated successfully`)
      setEditingReceipt(null)
      setEditNotes('')
    } catch (error) {
      console.error('Update error:', error)

      // Check if error is related to sanitization
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('Invalid content')) {
        toast.error(
          t`Invalid content detected in notes. Please remove any HTML tags or special characters.`
        )
      } else {
        toast.error(t`Failed to update notes. Please try again.`)
      }
    }
  }

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingReceipt(null)
    setEditNotes('')
  }

  // Handle delete start
  const handleDeleteStart = (receipt: Receipt) => {
    setReceiptToDelete(receipt)
    setDeleteDialogOpen(true)
  }

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return

    const deletedFileOrder = receiptToDelete.file_order

    try {
      await deleteMutation.mutateAsync({
        receiptId: receiptToDelete.$id,
        fileId: receiptToDelete.file_id,
        contestId,
      })

      // Reorder remaining receipts
      const remainingReceipts = receipts.filter(
        (r) => r.$id !== receiptToDelete.$id
      )

      // Update file_order for receipts that came after the deleted one
      const reorder = async (receiptId: string, newOrder: number) => {
        if (BACKEND === 'supabase') {
          const { updateReceiptFileOrderSupabase } = await import(
            'app/lib/supabase'
          )
          return updateReceiptFileOrderSupabase(receiptId, newOrder)
        }
        const { updateReceiptFileOrder } = await import('app/lib/receipts/api')
        return updateReceiptFileOrder(receiptId, newOrder)
      }
      const updatePromises = remainingReceipts
        .filter((r) => r.file_order > deletedFileOrder)
        .map(async (receipt) => {
          try {
            await reorder(receipt.$id, receipt.file_order - 1)
          } catch (error) {
            console.error(`Failed to reorder receipt ${receipt.$id}:`, error)
          }
        })

      // Wait for all reordering to complete
      await Promise.all(updatePromises)

      // Force refetch of receipts to show updated order
      await queryClient.invalidateQueries({
        queryKey: ['receipts', 'contest', contestId, user?.$id],
      })

      toast.success(t`Receipt deleted successfully`)
      setDeleteDialogOpen(false)
      setReceiptToDelete(null)
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t`Failed to delete receipt. Please try again.`)
    }
  }

  // Handle image view
  const handleViewImage = (index: number) => {
    const imageReceipts = receipts.filter((r) => isImageFile(r.file_type))
    const targetReceipt = receipts[index]

    if (!targetReceipt) return

    // Image URIs come from the async signed-URL query; don't open an empty
    // gallery before the URL is ready (mirrors the PDF-view guard).
    if (!fileUrls[targetReceipt.file_id]) {
      toast.error(t`Preparing file, please try again in a moment`)
      return
    }

    const imageIndex = imageReceipts.findIndex(
      (r) => r.$id === targetReceipt.$id
    )

    if (imageIndex >= 0) {
      setSelectedImageIndex(imageIndex)
      setGalleryVisible(true)
    }
  }

  // Handle PDF view
  const handleViewPDF = async (receipt: Receipt) => {
    const url = fileUrls[receipt.file_id]
    if (!url) {
      toast.error(t`Preparing file, please try again in a moment`)
      return
    }
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        toast.error(t`Cannot open PDF file`)
      }
    } catch (error) {
      console.error('Failed to open PDF:', error)
      toast.error(t`Failed to open PDF file`)
    }
  }

  // Prepare gallery images (only images, not PDFs)
  const galleryImages: ImageItem[] = receipts
    .filter((r) => isImageFile(r.file_type))
    .map((receipt, index) => ({
      id: receipt.file_id,
      uri: fileUrls[receipt.file_id] || '',
      title: contestTitle,
      description: receipt.notes || t`Receipt ${index + 1}`,
    }))

  return (
    <>
      <RNModal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
        presentationStyle="fullScreen"
      >
        <View className="flex-1 bg-white dark:bg-black">
          {/* Header */}
          <View
            className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-3"
            style={{
              paddingTop: Platform.OS === 'ios' ? 50 : 20,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-black dark:text-white">
                <Trans>Manage Receipts</Trans>
              </Text>
              <Pressable onPress={onClose} className="p-2 -mr-2">
                <XMarkOutline className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Pressable>
            </View>
            <Text
              className="text-sm text-gray-600 dark:text-gray-400 mt-0.5"
              numberOfLines={1}
            >
              {contestTitle}
            </Text>

            {/* Limit Indicators */}
            <View className="flex-row gap-3 mt-3">
              <View className="flex-1 bg-blue-50 dark:bg-blue-950 rounded-lg px-3 py-2">
                <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <Trans>Contests With Receipts</Trans>
                </Text>
                <Text className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {contestCount}/{isContestLimitUnlimited ? '∞' : maxContests}
                </Text>
              </View>
              <View className="flex-1 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2">
                <Text className="text-xs text-green-600 dark:text-green-400 font-medium">
                  <Trans>Receipts Per Contest</Trans>
                </Text>
                <Text className="text-lg font-bold text-green-700 dark:text-green-300">
                  {receiptCount}/{isReceiptLimitUnlimited ? '∞' : maxReceipts}
                </Text>
              </View>
            </View>

            {/* Warning Messages */}
            {atContestLimit && (
              <View className="mt-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                <Text className="text-xs text-yellow-700 dark:text-yellow-300">
                  <Trans>
                    You've reached the limit of {maxContests} contests with
                    receipts. Upgrade to Pro for unlimited contests.
                  </Trans>
                </Text>
              </View>
            )}
            {atReceiptLimit && (
              <View className="mt-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                <Text className="text-xs text-yellow-700 dark:text-yellow-300">
                  <Trans>
                    Maximum {maxReceipts} receipts per contest. Upgrade to Pro
                    for more receipts.
                  </Trans>
                </Text>
              </View>
            )}
          </View>

          {/* Content */}
          <ScrollView
            ref={(ref) => {
              // Store ref for auto-scroll (both web and native)
              if (ref) {
                if (Platform.OS === 'web') {
                  ;(window as any).receiptScrollView = ref
                } else {
                  // For native, store in a module-level variable
                  scrollViewRef.current = ref
                }
              }
            }}
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
          >
            {/* Privacy Notice - Hide when at contest limit */}
            {!atContestLimit && (
              <View className="bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-3 mb-4">
                <Text className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  <Trans>
                    Your uploaded digital receipts are private and are mainly
                    for references only. Contest organizers may require your
                    original receipts for verification purposes. We are not
                    liable for any loss or damage to your uploaded receipts.
                  </Trans>
                </Text>
              </View>
            )}

            {/* Loading State */}
            {isLoadingReceipts && (
              <View className="py-8 items-center">
                <ActivityIndicator
                  size="large"
                  color={
                    isDarkColorScheme ? Colors.dark.tint : Colors.light.tint
                  }
                />
              </View>
            )}

            {/* Receipts List */}
            {!isLoadingReceipts && receipts.length > 0 && (
              <View className="gap-4 mb-6">
                {receipts.map((receipt, index) => (
                  <View key={receipt.$id}>
                    {/* Thumbnail */}
                    <ReceiptThumbnail
                      receipt={receipt}
                      jwt={jwt}
                      imageUrl={fileUrls[receipt.file_id]}
                      onPress={() => {
                        if (isImageFile(receipt.file_type)) {
                          handleViewImage(index)
                        } else {
                          handleViewPDF(receipt)
                        }
                      }}
                      onEdit={() => handleEditStart(receipt)}
                      onDelete={() => handleDeleteStart(receipt)}
                    />

                    {/* Edit Notes Form */}
                    {editingReceipt?.$id === receipt.$id && (
                      <View className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <Label className="mb-2">
                          <Trans>Note</Trans> {receipt.file_order + 1}
                        </Label>
                        <TextInput
                          value={editNotes}
                          onChangeText={setEditNotes}
                          placeholder={t`e.g., Entry 1, Receipt for product X`}
                          placeholderTextColor="#9CA3AF"
                          multiline
                          numberOfLines={3}
                          scrollEnabled={false}
                          style={Platform.select({
                            web: {
                              width: '100%',
                              minHeight: 80,
                              padding: 12,
                              borderWidth: 1,
                              borderRadius: 8,
                              textAlignVertical: 'top',
                              fontSize: fontSize.base, // Use text scale (>= 16px)
                              marginBottom: 12,
                            },
                            default: {
                              width: '100%',
                              height: 80,
                              padding: 12,
                              borderWidth: 1,
                              borderRadius: 8,
                              textAlignVertical: 'top',
                              fontSize: fontSize.base,
                              marginBottom: 12,
                            },
                          })}
                          className="border-input bg-background text-foreground"
                        />
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Button
                              onPress={handleEditCancel}
                              variant="outline"
                              disabled={updateMutation.isPending}
                              className="h-10"
                            >
                              <Text>
                                <Trans>Cancel</Trans>
                              </Text>
                            </Button>
                          </View>
                          <View className="flex-1">
                            <Button
                              onPress={handleEditSave}
                              disabled={updateMutation.isPending}
                              className="h-10"
                            >
                              {updateMutation.isPending ? (
                                <ActivityIndicator
                                  size="small"
                                  color={isDarkColorScheme ? '#000' : 'white'}
                                />
                              ) : (
                                <Text>
                                  <Trans>Save</Trans>
                                </Text>
                              )}
                            </Button>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Empty State */}
            {!isLoadingReceipts && receipts.length === 0 && (
              <View className="py-12 items-center">
                <Text className="text-6xl mb-4">📄</Text>
                <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                  <Trans>No Receipts Yet</Trans>
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 text-center px-4">
                  {atContestLimit ? (
                    <Trans>
                      Upgrade to Pro to continue to add receipts to more
                      contests
                    </Trans>
                  ) : (
                    <Trans>Upload your first receipt to get started</Trans>
                  )}
                </Text>
              </View>
            )}

            {/* Add New Receipt Section - Collapsible */}
            {!atReceiptLimit && !atContestLimit && (
              <Collapsible
                open={addReceiptOpen}
                onOpenChange={(open) => {
                  setAddReceiptOpen(open)

                  // Reset CAPTCHA when closing (widget will unmount)
                  if (!open) {
                    setCaptchaToken('')
                    setIsCaptchaReady(false)
                  }

                  // Auto-scroll to bottom when opening (both web and native)
                  if (open) {
                    setTimeout(() => {
                      if (Platform.OS === 'web') {
                        // Web: Get from window
                        const scrollView = (window as any).receiptScrollView
                        if (scrollView && scrollView.scrollToEnd) {
                          scrollView.scrollToEnd({ animated: true })
                        }
                      } else {
                        // Native: Get from ref
                        if (scrollViewRef.current) {
                          scrollViewRef.current.scrollToEnd({ animated: true })
                        }
                      }
                    }, 150) // Small delay to let collapsible expand
                  }
                }}
              >
                <View className="border border-border rounded-lg overflow-hidden">
                  {/* Collapsible Trigger */}
                  <CollapsibleTrigger asChild>
                    <Pressable className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <PlusOutline className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        <Text className="text-base font-semibold text-gray-700 dark:text-gray-300">
                          <Trans>Add New Receipt</Trans>
                        </Text>
                      </View>
                      {addReceiptOpen ? (
                        <ChevronDoubleUpOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      ) : (
                        <ChevronDoubleDownOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      )}
                    </Pressable>
                  </CollapsibleTrigger>

                  {/* Collapsible Content */}
                  <CollapsibleContent>
                    <View className="p-4 bg-white dark:bg-black">
                      {/* Notes Input (always visible when expanded) */}
                      <View className="mb-4">
                        <Label className="mb-2">
                          <Trans>Note (optional)</Trans>
                        </Label>
                        <TextInput
                          value={uploadNotes}
                          onChangeText={setUploadNotes}
                          placeholder={t`e.g., Entry 1, Receipt for product X`}
                          placeholderTextColor="#9CA3AF"
                          multiline
                          numberOfLines={2}
                          maxLength={200}
                          editable={!uploadMutation.isPending}
                          style={Platform.select({
                            web: {
                              width: '100%',
                              minHeight: 60,
                              padding: 12,
                              borderWidth: 1,
                              borderRadius: 8,
                              textAlignVertical: 'top',
                              fontSize: fontSize.base, // Use text scale (>= 16px)
                              opacity: uploadMutation.isPending ? 0.5 : 1,
                            },
                            default: {
                              width: '100%',
                              height: 60,
                              padding: 12,
                              borderWidth: 1,
                              borderRadius: 8,
                              textAlignVertical: 'top',
                              fontSize: fontSize.base,
                              opacity: uploadMutation.isPending ? 0.5 : 1,
                            },
                          })}
                          className={cn(
                            'border-input bg-background text-foreground',
                            uploadMutation.isPending && 'opacity-50'
                          )}
                        />
                      </View>

                      {/* Add Receipt Buttons */}
                      <View className="gap-4 py-2 mb-2">
                        {/* Image Receipt Row - with Scan button on web */}
                        <View
                          className={
                            Platform.OS === 'web' ? 'flex-row gap-2' : ''
                          }
                        >
                          <Button
                            onPress={() => handleAddReceipt('image')}
                            disabled={
                              uploadMutation.isPending ||
                              atContestLimit ||
                              !captchaToken
                            }
                            className={cn(
                              'h-auto py-2 px-2',
                              Platform.OS === 'web' && 'flex-1',
                              (atContestLimit || !captchaToken) && 'opacity-50'
                            )}
                            style={
                              Platform.OS !== 'web'
                                ? {
                                    height: 'auto',
                                    paddingTop: 8,
                                    paddingBottom: 8,
                                  }
                                : undefined
                            }
                          >
                            {uploadingType === 'image' ? (
                              <ActivityIndicator
                                size="small"
                                color={isDarkColorScheme ? '#000' : 'white'}
                              />
                            ) : (
                              <View className="items-center flex-1">
                                <Text className="text-center" numberOfLines={1}>
                                  📷 <Trans>Add Image</Trans>
                                </Text>
                                <Text
                                  className="text-xs opacity-70 mt-0.5 text-center"
                                  numberOfLines={1}
                                >
                                  jpg, png, webp, heic
                                </Text>
                              </View>
                            )}
                          </Button>

                          {/* Scan Document Button - Web Only */}
                          {Platform.OS === 'web' && (
                            <Button
                              onPress={() => setScannerVisible(true)}
                              disabled={
                                uploadMutation.isPending ||
                                atContestLimit ||
                                !captchaToken
                              }
                              variant="secondary"
                              className={cn(
                                'h-auto py-2 px-2 flex-1',
                                (atContestLimit || !captchaToken) &&
                                  'opacity-50'
                              )}
                            >
                              {uploadingType === 'scan' ? (
                                <ActivityIndicator
                                  size="small"
                                  color={
                                    isDarkColorScheme
                                      ? Colors.dark.tint
                                      : Colors.light.tint
                                  }
                                />
                              ) : (
                                <View className="items-center flex-1">
                                  <Text
                                    className="text-center"
                                    numberOfLines={1}
                                  >
                                    📸 <Trans>Scan</Trans>
                                  </Text>
                                  <Text
                                    className="text-xs opacity-70 mt-0.5 text-center"
                                    numberOfLines={1}
                                  >
                                    <Trans>(beta phase)</Trans>
                                  </Text>
                                </View>
                              )}
                            </Button>
                          )}
                        </View>
                        <Button
                          onPress={() => handleAddReceipt('pdf')}
                          variant="outline"
                          disabled={
                            uploadMutation.isPending ||
                            atContestLimit ||
                            !captchaToken
                          }
                          className={cn(
                            'h-auto py-2 px-2',
                            (atContestLimit || !captchaToken) && 'opacity-50'
                          )}
                          style={
                            Platform.OS !== 'web'
                              ? {
                                  height: 'auto',
                                  paddingTop: 8,
                                  paddingBottom: 8,
                                }
                              : undefined
                          }
                        >
                          {uploadingType === 'pdf' ? (
                            <View
                              className="items-center justify-center"
                              style={{ minHeight: 44 }}
                            >
                              <ActivityIndicator
                                size="small"
                                color={
                                  isDarkColorScheme
                                    ? Colors.dark.tint
                                    : Colors.light.tint
                                }
                              />
                            </View>
                          ) : (
                            <View className="items-center">
                              <Text className="text-center" numberOfLines={1}>
                                📄 <Trans>Add PDF</Trans>
                              </Text>
                              <Text
                                className="text-xs opacity-70 mt-0.5 text-center"
                                numberOfLines={1}
                              >
                                pdf
                              </Text>
                            </View>
                          )}
                        </Button>
                      </View>

                      {/* CAPTCHA Protection */}
                      <View className="p-2 border border-border rounded-lg bg-muted/30">
                        <View className="flex-row items-center justify-center mb-1 mt-1">
                          <Text className="text-sm font-medium">
                            <Trans>Security Verification</Trans>
                          </Text>
                          {!isCaptchaReady && (
                            <View className="ml-2">
                              <ActivityIndicator
                                size="small"
                                color={
                                  isDarkColorScheme
                                    ? Colors.dark.tint
                                    : Colors.light.tint
                                }
                              />
                            </View>
                          )}
                        </View>
                        <View className="items-center">
                          <TurnstileWidget
                            siteKey={TURNSTILE_SITE_KEY}
                            resetSignal={captchaResetSignal}
                            onSuccess={setCaptchaToken}
                            onReady={() => setIsCaptchaReady(true)}
                            onError={() => {
                              setCaptchaToken('')
                              setIsCaptchaReady(false)
                              // Re-mint after an error too — otherwise the widget
                              // can get stuck in an error state with no token and
                              // no way to recover without reloading the app/page.
                              setCaptchaResetSignal((n) => n + 1)
                            }}
                            onExpire={() => {
                              setCaptchaToken('')
                              setIsCaptchaReady(false)
                            }}
                          />
                        </View>
                        {!captchaToken && isCaptchaReady && (
                          <Text className="text-xs text-muted-foreground mt-1 text-center">
                            <Trans>
                              Complete verification to upload receipts
                            </Trans>
                          </Text>
                        )}
                      </View>
                    </View>
                  </CollapsibleContent>
                </View>
              </Collapsible>
            )}
          </ScrollView>
        </View>
      </RNModal>

      {/* Image Gallery for viewing images */}
      <ImageGallery
        images={galleryImages}
        initialIndex={selectedImageIndex}
        isVisible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete Receipt?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                Are you sure you want to delete this receipt? This action cannot
                be undone.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPress={() => {
                setDeleteDialogOpen(false)
                setReceiptToDelete(null)
              }}
              disabled={deleteMutation.isPending}
            >
              <Text>
                <Trans>Cancel</Trans>
              </Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-500"
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white">
                  <Trans>Delete</Trans>
                </Text>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Scanner Modal - Web Only */}
      {Platform.OS === 'web' && (
        <DocumentScanner
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onCapture={handleScannedDocument}
        />
      )}
    </>
  )
}
