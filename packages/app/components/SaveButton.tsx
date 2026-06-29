import { useEffect, useState } from 'react'
import {
  Pressable,
  ActivityIndicator,
  Platform,
  TextInput,
  View,
} from 'react-native'
import { useLingui } from '@lingui/react/macro'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { Trans } from '@lingui/react/macro'
import { useAuth } from 'app/contexts/AuthContext'
import { useRouter } from 'app/lib/router-universal'
import { useSaveStatus, useSaveActions } from 'app/hooks/useSave'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'
import { BookmarkWithBadge } from 'app/components/icons-svg/BookmarkWithBadge'
import { BookmarkSolidWithBadge } from 'app/components/icons-svg/BookmarkSolidWithBadge'
import { Text } from 'app/components/ui/text'
import { Label } from 'app/components/ui/label'
import { cn } from 'app/lib/utils'
import { toast } from 'app/lib/sonner-universal'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'app/components/ui/alert-dialog'
import { Button } from 'app/components/ui/button'
import { archiveContestReceipts } from 'app/lib/receipts/api'
import { useTextScale } from 'app/contexts/TextScaleContext'
import { BACKEND } from 'app/lib/backend'

export interface SaveButtonProps {
  contestId: string
  variant?: 'default' | 'compact' | 'large'
  showText?: boolean
  className?: string
  onSaveChange?: (isSaved: boolean) => void
  preventAutoAction?: boolean // If true, only call onSaveChange without performing save/unsave
  receiptCount?: number // Number of receipts uploaded for this contest (0-3)
  onManageReceipts?: () => void // Callback to open receipt manager modal when clicking saved button
  contestTitle?: string // Contest title for unsave dialog
}

export function SaveButton({
  contestId,
  variant = 'default',
  showText = true,
  className,
  onSaveChange,
  preventAutoAction = false,
  receiptCount = 0,
  onManageReceipts,
  contestTitle,
}: SaveButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const inactiveNativeColor = isDarkColorScheme ? '#9ca3af' : '#4b5563'

  const { t } = useLingui()
  const { fontSize } = useTextScale()

  // Unsave confirmation dialog state
  const [unsaveDialogOpen, setUnsaveDialogOpen] = useState(false)
  // Sign-in prompt dialog state for anonymous users
  const [signInDialogOpen, setSignInDialogOpen] = useState(false)
  // Archiving state (separate from mutation loading for better UX)
  const [isArchiving, setIsArchiving] = useState(false)
  // Confirmation text state (for contests with receipts)
  const [unsaveConfirmText, setUnsaveConfirmText] = useState('')
  const [confirmTextError, setConfirmTextError] = useState(false)

  // Hooks for data and actions
  const { data: isSaved, isLoading: isStatusLoading } = useSaveStatus(contestId)
  const {
    save,
    removeSave,
    isLoading: isActionLoading,
    error,
    saveResult,
  } = useSaveActions(contestId)

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error(getErrorMessage(error))
    }
  }, [error])

  // Show non-blocking warning if auto-upvote failed
  useEffect(() => {
    if (saveResult?.warning) {
      toast.warning(i18n._(msg`Contest saved, but automatic upvote failed`), {
        duration: 3000,
      })
    }
  }, [saveResult])

  // Determine if button is in loading state
  const isLoading = isStatusLoading || isActionLoading || isArchiving

  // Handle button click
  const handlePress = () => {
    // Check authentication - show dialog for anonymous users
    if (!user) {
      setSignInDialogOpen(true)
      return
    }

    if (BACKEND !== 'appwrite') {
      toast.info(t`Save is not available in the Supabase spike yet`)
      return
    }

    // If preventAutoAction is true, only call the callback without performing the action
    if (preventAutoAction) {
      if (isSaved !== undefined) {
        onSaveChange?.(isSaved)
      }
      return
    }

    // If already saved, show confirmation dialog
    if (isSaved === true) {
      setUnsaveConfirmText('') // Reset confirmation text
      setConfirmTextError(false) // Reset error state
      setUnsaveDialogOpen(true)
      return
    }

    // If not saved, save it
    if (isSaved === false) {
      save()
      // Call onSaveChange callback if provided
      onSaveChange?.(true)
    }
  }

  // Handle sign-in from dialog
  const handleSignIn = () => {
    setSignInDialogOpen(false)
    router.push('/sign-in-register?redirect=/')
  }

  // Handle unsave confirmation
  const handleUnsaveConfirm = async () => {
    // If contest has receipts, validate confirmation text
    if (receiptCount > 0) {
      const expectedTextEn = 'confirm unsave'
      const expectedTextMs = 'sahkan nyahsimpan'
      const inputText = unsaveConfirmText.trim().toLowerCase()

      if (inputText !== expectedTextEn && inputText !== expectedTextMs) {
        setConfirmTextError(true)
        return
      }
      // Clear error if validation passes
      setConfirmTextError(false)
    }

    let archiveFailed = false

    try {
      setIsArchiving(true)

      // Archive receipts before unsaving (if user has any receipts for this contest)
      if (user?.$id && receiptCount > 0) {
        // Show loading toast - use user-friendly message
        toast.loading(t`Unsaving contest...`, { id: 'unsave-contest' })

        try {
          await archiveContestReceipts(
            user.$id,
            contestId,
            'Contest unsaved by user'
          )
          // Dismiss loading toast on success
          toast.dismiss('unsave-contest')
        } catch (archiveError) {
          console.error('Failed to archive receipts:', archiveError)
          archiveFailed = true
          // Continue with unsave even if archiving fails
          // The receipts will remain but won't be visible in UI
          toast.dismiss('unsave-contest')
          toast.warning(
            t`Contest unsaved, but receipts cleanup failed. Please contact support if you see issues.`,
            {
              duration: 5000,
            }
          )
        }
      }

      // Then unsave the contest (always proceed even if archive failed)
      removeSave()
      onSaveChange?.(false)
      setUnsaveDialogOpen(false)
      setUnsaveConfirmText('') // Reset confirmation text

      // Show success toast only if archive didn't fail (warning already shown if it did)
      if (!archiveFailed) {
        toast.success(t`Contest removed from saved list`)
      }
    } catch (error) {
      console.error('Failed to unsave contest:', error)
      toast.dismiss('unsave-contest')
      toast.error(t`Failed to unsave contest. Please try again.`)
      // Don't close dialog on error so user can retry
    } finally {
      setIsArchiving(false)
    }
  }

  // Handle manage receipts from dialog
  const handleManageReceipts = () => {
    setUnsaveDialogOpen(false)
    onManageReceipts?.()
  }

  // Variant-specific styles
  const buttonStyles = getButtonStyles(variant)
  const iconSize = getIconSize(variant)
  // Explicit pixel size for the SVG. Native (post-Uniwind) does not size
  // react-native-svg icons from `className`, so width/height props are required
  // or the icon renders at 0x0 (invisible but still pressable).
  const iconPx = getIconPx(variant)
  const textSize = getTextSize(variant)

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        className={cn(
          'flex-row items-center justify-center gap-1 rounded-full transition-all',
          buttonStyles.container,
          isLoading && 'opacity-50',
          Platform.OS === 'web' && 'hover:scale-105 active:scale-95',
          className
        )}
        style={({ pressed }) => ({
          opacity: Platform.OS !== 'web' && pressed ? 0.7 : 1,
        })}
        accessibilityLabel={isSaved ? t`Saved` : t`Save`}
        accessibilityRole="button"
      >
        {/* Icon */}
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isSaved ? main : '#6b7280'}
            className={iconSize}
          />
        ) : isSaved ? (
          receiptCount > 0 ? (
            <BookmarkSolidWithBadge
              count={receiptCount}
              className={cn(iconSize, Platform.OS === 'web' ? 'text-main' : '')}
              width={iconPx}
              height={iconPx}
              color={Platform.OS !== 'web' ? main : undefined}
              accessibilityLabel={`Saved with ${receiptCount} receipt${
                receiptCount > 1 ? 's' : ''
              }`}
            />
          ) : (
            <BookmarkSolidIcon
              className={cn(iconSize, Platform.OS === 'web' ? 'text-main' : '')}
              width={iconPx}
              height={iconPx}
              color={Platform.OS !== 'web' ? main : undefined}
              accessibilityLabel="Saved"
            />
          )
        ) : receiptCount > 0 ? (
          <BookmarkWithBadge
            count={receiptCount}
            className={cn(iconSize, 'text-gray-600 dark:text-gray-400')}
            width={iconPx}
            height={iconPx}
            color={Platform.OS !== 'web' ? inactiveNativeColor : undefined}
            accessibilityLabel={`Save with ${receiptCount} receipt${
              receiptCount > 1 ? 's' : ''
            }`}
          />
        ) : (
          <BookmarkIcon
            className={cn(iconSize, 'text-gray-600 dark:text-gray-400')}
            width={iconPx}
            height={iconPx}
            color={Platform.OS !== 'web' ? inactiveNativeColor : undefined}
            accessibilityLabel="Save"
          />
        )}

        {/* Label */}
        {showText && (
          <Text
            className={cn(
              'font-medium',
              textSize,
              isSaved
                ? Platform.OS === 'web'
                  ? 'text-main'
                  : ''
                : 'text-gray-700 dark:text-gray-300'
            )}
            style={
              Platform.OS !== 'web'
                ? { color: isSaved ? main : inactiveNativeColor }
                : undefined
            }
          >
            {isSaved ? t`Saved` : t`Save`}
          </Text>
        )}
      </Pressable>

      {/* Sign-in Dialog for Anonymous Users */}
      <AlertDialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Sign In Required</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                Please sign in to save contests and track your participation!
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>
                <Trans>Cancel</Trans>
              </Text>
            </AlertDialogCancel>
            <Button onPress={handleSignIn}>
              <Text>
                <Trans>Sign In</Trans>
              </Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsave Confirmation Dialog */}
      <AlertDialog
        open={unsaveDialogOpen}
        onOpenChange={(open) => {
          setUnsaveDialogOpen(open)
          if (!open) {
            setUnsaveConfirmText('')
            setConfirmTextError(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Unsave Contest?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {receiptCount > 0 ? (
                <Trans>
                  You have uploaded receipt(s) for "
                  {contestTitle || 'this contest'}". Your receipts will be
                  removed from your profile. Are you sure you want to proceed?
                </Trans>
              ) : (
                <Trans>
                  Are you sure you want to remove "
                  {contestTitle || 'this contest'}" from your saved contests?
                  You can always save it again later.
                </Trans>
              )}
            </AlertDialogDescription>

            {/* Confirmation Text Input - Only show if contest has receipts */}
            {receiptCount > 0 && (
              <View className="mt-4 w-full">
                <Label className="mb-2">
                  <Trans>Type to confirm:</Trans>{' '}
                  <Text className="font-bold">
                    <Trans>Confirm Unsave</Trans>
                  </Text>
                </Label>
                <TextInput
                  value={unsaveConfirmText}
                  onChangeText={(text) => {
                    setUnsaveConfirmText(text)
                    // Clear error when user starts typing
                    if (confirmTextError) {
                      setConfirmTextError(false)
                    }
                  }}
                  placeholder={t`Type here...`}
                  placeholderTextColor="#9CA3AF"
                  editable={!isArchiving}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    width: '100%',
                    height: 44,
                    padding: 12,
                    borderWidth: 1,
                    borderRadius: 8,
                    fontSize: fontSize.base,
                  }}
                  className={cn(
                    'bg-background text-foreground',
                    confirmTextError
                      ? 'border-red-500 dark:border-red-400'
                      : 'border-input'
                  )}
                />
                {confirmTextError && (
                  <Text className="text-xs text-red-500 dark:text-red-400 mt-1">
                    <Trans>
                      Please type "Confirm Unsave" or "confirm unsave" exactly
                    </Trans>
                  </Text>
                )}
              </View>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPress={() => {
                setUnsaveDialogOpen(false)
                setUnsaveConfirmText('')
                setConfirmTextError(false)
              }}
            >
              <Text>
                <Trans>Cancel</Trans>
              </Text>
            </AlertDialogCancel>

            {/* Manage Receipts Button - Only show if onManageReceipts is provided */}
            {onManageReceipts && (
              <Button
                onPress={handleManageReceipts}
                variant="outline"
                className={Platform.OS === 'web' ? 'border-main' : ''}
                style={
                  Platform.OS !== 'web' ? { borderColor: main } : undefined
                }
              >
                <Text
                  className={Platform.OS === 'web' ? 'text-main' : ''}
                  style={Platform.OS !== 'web' ? { color: main } : undefined}
                >
                  <Trans>Manage Receipts</Trans>
                </Text>
              </Button>
            )}

            <Button
              onPress={handleUnsaveConfirm}
              className="bg-red-500"
              disabled={isArchiving}
            >
              {isArchiving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white">
                  <Trans>Confirm Unsave</Trans>
                </Text>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Helper function to get error message
function getErrorMessage(error: Error | null): string {
  if (!error) return ''

  const message = error.message.toLowerCase()

  if (message.includes('not authenticated') || message.includes('401')) {
    return i18n._(msg`Please log in to save contests`)
  }

  if (message.includes('already saved') || message.includes('409')) {
    return i18n._(msg`You've already saved this contest`)
  }

  if (message.includes('network') || message.includes('fetch')) {
    return i18n._(
      msg`Unable to save. Please check your connection and try again`
    )
  }

  return i18n._(msg`Something went wrong. Please try again`)
}

// Helper function to get button styles based on variant
function getButtonStyles(variant: 'default' | 'compact' | 'large') {
  switch (variant) {
    case 'compact':
      return {
        container: 'px-2 py-1',
      }
    case 'large':
      return {
        container: 'px-4 py-2',
      }
    case 'default':
    default:
      return {
        container: 'px-3 py-1.5',
      }
  }
}

// Helper function to get icon size based on variant
function getIconSize(variant: 'default' | 'compact' | 'large'): string {
  switch (variant) {
    case 'compact':
      return 'w-5 h-5'
    case 'large':
      return 'w-7 h-7'
    case 'default':
    default:
      return 'w-5 h-5'
  }
}

// Pixel equivalent of getIconSize (w-5 = 20px, w-7 = 28px). Required for native.
function getIconPx(variant: 'default' | 'compact' | 'large'): number {
  switch (variant) {
    case 'large':
      return 28
    case 'compact':
    case 'default':
    default:
      return 20
  }
}

// Helper function to get text size based on variant
function getTextSize(variant: 'default' | 'compact' | 'large'): string {
  switch (variant) {
    case 'compact':
      return 'text-sm'
    case 'large':
      return 'text-lg'
    case 'default':
    default:
      return 'text-sm'
  }
}
