import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  ScrollView,
  View,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { Image as ExpoImage } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Textarea } from 'app/components/ui/textarea'
import { Text } from 'app/components/ui/text'
import { Label } from 'app/components/ui/label'
import { Badge } from 'app/components/ui/badge'
import { Separator } from 'app/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'app/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'app/components/ui/alert-dialog'

import {
  searchSupabaseContestsForEdit,
  loadSupabaseContestForEdit,
  updateSupabaseContest,
  deleteSupabaseContest,
  contentPublicUrl,
  CONTESTS_BUCKET,
} from 'app/lib/supabase/admin'
import {
  createContestSchema,
  CreateContestFormData,
} from './createContestSchema'
import SingleDateTimePicker from 'app/components/SingleDateTimePicker'
import SingleDateTimePickerMobile from 'app/components/SingleDateTimePickerMobile'
import HostManagerModal, { HostDoc as HostModalDoc } from './HostManagerModal'
import CategoryManagerModal, {
  CategoryDoc as CategoryModalDoc,
} from './CategoryManagerModal'
import { toast } from 'app/lib/sonner-universal'
import { TrashOutline } from 'app/components/icons-svg/TrashOutline'
import { DraggableHostBadge } from 'app/components/admin/DraggableHostBadge'
import { DraggableCategoryBadge } from 'app/components/admin/DraggableCategoryBadge'
import { detectSuspiciousLineBreaks } from 'app/utils/lineBreakDetection'

const ENGLISH_INPUT_CLASSNAME =
  'border border-main focus:border-main focus:ring-1 focus:ring-main'
const DEFAULT_BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

interface EditContestTabContentProps {
  user: any
  isDarkColorScheme: boolean
  containerMaxWidth: number
  isDesktopLayout: boolean
  // Optional slug from a review deep-link (/admin?tab=edit&slug=...): pre-fills
  // the search in slug mode so an ingested (visibility='admin') contest opens
  // ready to review.
  initialEditSlug?: string
}

interface ContestDocument {
  $id: string
  title: string
  title_ms: string | null
  summary: string
  summary_ms: string | null
  start_date: string
  end_date: string
  host_ids: string[]
  category_ids: string[]
  slug: string
  total_prizes_value_rm: number | null
  link_aff_shopee: string | null
  link_aff_lazada: string | null
  link_aff_tiktok_shop: string | null
  link_media_instagram: string | null
  link_media_facebook: string | null
  link_media_tiktok: string | null
  link_media_x: string | null
  link_media_youtube: string | null
  link_media_linkedin: string | null
  link_media_website: string | null
  main_img_id: string | null
  main_img_token_secret: string | null
  main_img_blurhash: string | null
  visibility: 'any' | 'users' | 'admin'
  $createdAt: string
  $updatedAt: string
}

interface ContestTranslation {
  $id: string
  contest_id: string
  locale: string
  prizes: string
  link_tnc: string | null
  link_faq: string | null
  eligible_products_and_purchases: string | null
  eligible_participants: string | null
  eligible_participants_exclusion: string | null
  eligible_stores: string | null
  winners_selection_method: string | null
  winners_comm_and_timeline: string | null
  entry_method_and_submission: string | null
  winners_list_and_announcement: string | null
}

interface ContestFile {
  $id: string
  file_id: string
  contest_id: string
  preview_img_width: number | null
  preview_img_height: number | null
  file_label: string | null
  file_order: number | null
  token_id: string | null
  token_secret: string | null
  img_blurhash: string | null
}

export default function EditContestTabContent({
  isDarkColorScheme,
  containerMaxWidth,
  isDesktopLayout,
  initialEditSlug,
}: EditContestTabContentProps) {
  const queryClient = useQueryClient()
  const { main, mainForeground } = useColorThemeValues(isDarkColorScheme)

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<CreateContestFormData>({
    resolver: valibotResolver(createContestSchema),
    defaultValues: {
      title: '',
      title_ms: '',
      summary: '',
      summary_ms: '',
      start_date: '',
      end_date: '',
      slug: '',
      total_prizes_value_rm: '',
      link_aff_shopee: '',
      link_aff_lazada: '',
      link_aff_tiktok_shop: '',
      link_media_instagram: '',
      link_media_facebook: '',
      link_media_tiktok: '',
      link_media_x: '',
      link_media_youtube: '',
      link_media_linkedin: '',
      link_media_website: '',
      prizes_en: '',
      prizes_ms: '',
      link_tnc_en: '',
      link_tnc_ms: '',
      link_faq_en: '',
      link_faq_ms: '',
      eligible_products_en: '',
      eligible_products_ms: '',
      eligible_participants_en: '',
      eligible_participants_ms: '',
      eligible_participants_exclusion_en: '',
      eligible_participants_exclusion_ms: '',
      eligible_stores_en: '',
      eligible_stores_ms: '',
      winners_selection_method_en: '',
      winners_selection_method_ms: '',
      winners_comm_and_timeline_en: '',
      winners_comm_and_timeline_ms: '',
      entry_method_en: '',
      entry_method_ms: '',
      winners_list_and_announcement_en: '',
      winners_list_and_announcement_ms: '',
      visibility: 'users',
    },
  })

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [contests, setContests] = useState<ContestDocument[]>([])
  const [isLoadingContests, setIsLoadingContests] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [contestHosts, setContestHosts] = useState<
    Record<string, HostModalDoc[]>
  >({})
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'title' | 'slug'>('title')

  // Selected contest state
  const [selectedContest, setSelectedContest] =
    useState<ContestDocument | null>(null)
  const [isLoadingContestDetails, setIsLoadingContestDetails] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Host and category state
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([])
  const [selectedHostDocs, setSelectedHostDocs] = useState<HostModalDoc[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedCategoryDocs, setSelectedCategoryDocs] = useState<
    CategoryModalDoc[]
  >([])

  // Image state
  const [existingImages, setExistingImages] = useState<ContestFile[]>([])
  const [newGalleryAssets, setNewGalleryAssets] = useState<any[]>([])
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([])
  const [mainImageId, setMainImageId] = useState<string | null>(null)
  const [newMainImageUri, setNewMainImageUri] = useState<string | null>(null) // For new images

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Expanded mode for textareas (default to true)
  const [isExpandedMode, setIsExpandedMode] = useState(true)

  // Watch form values for slug generation
  const watchTitle = watch('title')
  const watchStartDate = watch('start_date')
  const watchEndDate = watch('end_date')

  // Drag and drop instance IDs (for web only)
  const hostInstanceId = useMemo(() => Symbol('hosts'), [])
  const categoryInstanceId = useMemo(() => Symbol('categories'), [])

  // Reorder functions for drag and drop
  const handleHostReorder = useCallback(
    (startIndex: number, endIndex: number) => {
      const newHosts = [...selectedHostDocs]
      const [movedHost] = newHosts.splice(startIndex, 1)

      if (movedHost) {
        newHosts.splice(endIndex, 0, movedHost)

        setSelectedHostDocs(newHosts)
        setSelectedHostIds(newHosts.map((h) => h.$id))
      }
    },
    [selectedHostDocs]
  )

  const handleCategoryReorder = useCallback(
    (startIndex: number, endIndex: number) => {
      const newCategories = [...selectedCategoryDocs]
      const [movedCategory] = newCategories.splice(startIndex, 1)

      if (movedCategory) {
        newCategories.splice(endIndex, 0, movedCategory)

        setSelectedCategoryDocs(newCategories)
        setSelectedCategoryIds(newCategories.map((c) => c.$id))
      }
    },
    [selectedCategoryDocs]
  )

  // Slugify helper function
  const slugify = (value: string): string => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  // Generate slug function
  const generateSlug = useCallback(() => {
    const getLocalDate = (dateStr: string) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const start = getLocalDate(watchStartDate)
    const end = getLocalDate(watchEndDate)
    const hostPart = selectedHostDocs
      .map((h) => h.slug || slugify(h.name))
      .filter(Boolean)
      .join('-')
    const titlePart = slugify(watchTitle)
    const mainPart = [hostPart, titlePart]
      .filter((p) => !!p && p.trim())
      .join('-')
    const generated = `${mainPart}-from-${start}-until-${end}`
    setValue('slug', generated)
    toast.success('Slug regenerated!')
  }, [watchTitle, watchStartDate, watchEndDate, selectedHostDocs, setValue])

  // Search contests function
  const searchContests = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setContests([])
        setHasSearched(false)
        setContestHosts({})
        setSearchError(null)
        return
      }

      setIsLoadingContests(true)
      setHasSearched(true)
      setSearchError(null)

      try {
        try {
          const { contests: rows, hostsByContest } =
            await searchSupabaseContestsForEdit(query.trim(), searchMode)

          if (searchMode === 'slug' && rows.length === 0) {
            setSearchError(
              `Contest not found. No contest exists with slug: "${query.trim()}"`
            )
            setContests([])
            return
          }

          setContests(rows as unknown as ContestDocument[])
          setContestHosts(
            hostsByContest as unknown as Record<string, HostModalDoc[]>
          )
        } catch (error) {
          console.error('Failed to search contests (supabase):', error)
          setSearchError('Failed to search contests. Please try again.')
          toast.error('Failed to search contests')
        }
        return
      } finally {
        setIsLoadingContests(false)
      }
    },
    [searchMode]
  )

  // Helper function to extract slug from URL or return the input as-is
  const extractSlugFromQuery = useCallback((query: string): string => {
    const trimmedQuery = query.trim()

    // Check if it looks like a URL (starts with http:// or https://)
    if (trimmedQuery.match(/^https?:\/\/.+/)) {
      // Extract everything after the last slash
      const urlParts = trimmedQuery.split('/')
      const lastPart = urlParts[urlParts.length - 1]

      // If the last part exists and isn't empty, use it as the slug
      if (lastPart && lastPart.trim()) {
        return lastPart.trim()
      }
    }

    // Return the original query if it's not a URL or no slug found
    return trimmedQuery
  }, [])

  // Debounced search effect
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debounced search
    if (searchQuery.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        const processedQuery = extractSlugFromQuery(searchQuery)
        // Update input field if URL was processed
        if (processedQuery !== searchQuery.trim()) {
          setSearchQuery(processedQuery)
        }
        searchContests(processedQuery)
      }, 300)
    } else {
      // Clear results if search query is empty
      setContests([])
      setHasSearched(false)
    }

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, searchContests, extractSlugFromQuery])

  // Deep-link prefill: when arriving via /admin?tab=edit&slug=... (or from the
  // Drafts tab Review button), search for that contest by slug. Re-applies when
  // initialEditSlug changes so successive Drafts → Edit handoffs work.
  const lastAppliedInitialSlugRef = useRef<string | null>(null)
  useEffect(() => {
    const s = (initialEditSlug ?? '').trim()
    if (!s) return
    if (lastAppliedInitialSlugRef.current === s) return
    lastAppliedInitialSlugRef.current = s
    setSearchMode('slug')
    setSearchQuery(s)
  }, [initialEditSlug])

  // Manual search trigger (for search button)
  const handleManualSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term')
      return
    }

    // Extract slug from URL if needed, then search
    const processedQuery = extractSlugFromQuery(searchQuery)

    // Update the input field to show the extracted slug
    if (processedQuery !== searchQuery.trim()) {
      setSearchQuery(processedQuery)
    }

    // Clear debounce timer and search immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    searchContests(processedQuery)
  }, [searchQuery, searchContests, extractSlugFromQuery])

  // Populate form from contest data
  const populateFormFromContest = useCallback(
    (
      contest: ContestDocument,
      translations: ContestTranslation[],
      hostDocs: HostModalDoc[],
      categoryDocs: CategoryModalDoc[],
      contestFiles: ContestFile[]
    ) => {
      // Find English and Malay translations
      const enTranslation = translations.find((t) => t.locale === 'en')
      const msTranslation = translations.find((t) => t.locale === 'ms')

      // Use React Hook Form's reset() to populate all form fields
      reset({
        title: contest.title || '',
        title_ms: contest.title_ms || '',
        summary: contest.summary || '',
        summary_ms: contest.summary_ms || '',
        start_date: contest.start_date || '',
        end_date: contest.end_date || '',
        slug: contest.slug || '',
        total_prizes_value_rm: contest.total_prizes_value_rm
          ? String(contest.total_prizes_value_rm)
          : '',
        link_aff_shopee: contest.link_aff_shopee || '',
        link_aff_lazada: contest.link_aff_lazada || '',
        link_aff_tiktok_shop: contest.link_aff_tiktok_shop || '',
        link_media_instagram: contest.link_media_instagram || '',
        link_media_facebook: contest.link_media_facebook || '',
        link_media_tiktok: contest.link_media_tiktok || '',
        link_media_x: contest.link_media_x || '',
        link_media_youtube: contest.link_media_youtube || '',
        link_media_linkedin: contest.link_media_linkedin || '',
        link_media_website: contest.link_media_website || '',
        visibility: contest.visibility ?? 'users',
        // English translations
        prizes_en: enTranslation?.prizes || '',
        link_tnc_en: enTranslation?.link_tnc || '',
        link_faq_en: enTranslation?.link_faq || '',
        eligible_products_en:
          enTranslation?.eligible_products_and_purchases || '',
        eligible_participants_en: enTranslation?.eligible_participants || '',
        eligible_participants_exclusion_en:
          enTranslation?.eligible_participants_exclusion || '',
        eligible_stores_en: enTranslation?.eligible_stores || '',
        winners_selection_method_en:
          enTranslation?.winners_selection_method || '',
        winners_comm_and_timeline_en:
          enTranslation?.winners_comm_and_timeline || '',
        entry_method_en: enTranslation?.entry_method_and_submission || '',
        winners_list_and_announcement_en:
          enTranslation?.winners_list_and_announcement || '',
        // Malay translations
        prizes_ms: msTranslation?.prizes || '',
        link_tnc_ms: msTranslation?.link_tnc || '',
        link_faq_ms: msTranslation?.link_faq || '',
        eligible_products_ms:
          msTranslation?.eligible_products_and_purchases || '',
        eligible_participants_ms: msTranslation?.eligible_participants || '',
        eligible_participants_exclusion_ms:
          msTranslation?.eligible_participants_exclusion || '',
        eligible_stores_ms: msTranslation?.eligible_stores || '',
        winners_selection_method_ms:
          msTranslation?.winners_selection_method || '',
        winners_comm_and_timeline_ms:
          msTranslation?.winners_comm_and_timeline || '',
        entry_method_ms: msTranslation?.entry_method_and_submission || '',
        winners_list_and_announcement_ms:
          msTranslation?.winners_list_and_announcement || '',
      })

      // Set host and category data
      setSelectedHostIds(contest.host_ids || [])
      setSelectedHostDocs(hostDocs)
      setSelectedCategoryIds(contest.category_ids || [])
      setSelectedCategoryDocs(categoryDocs)

      // Set existing images
      setExistingImages(contestFiles)
      setMainImageId(contest.main_img_id)

      // Clear any pending changes
      setNewGalleryAssets([])
      setImagesToDelete([])
    },
    [reset]
  )

  // Load contest for editing
  const loadContestForEditing = useCallback(
    async (contestId: string) => {
      setIsLoadingContestDetails(true)
      setLoadError(null)
      try {
        const data = await loadSupabaseContestForEdit(contestId)
        setSelectedContest(data.contest as unknown as ContestDocument)
        populateFormFromContest(
          data.contest as unknown as ContestDocument,
          data.translations as unknown as ContestTranslation[],
          data.hostDocs as unknown as HostModalDoc[],
          data.categoryDocs as unknown as CategoryModalDoc[],
          data.contestFiles as unknown as ContestFile[]
        )
        console.log('Contest loaded successfully for editing (supabase)')
        return
      } catch (error) {
        console.error('Failed to load contest for editing:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred'

        // Check for network errors
        if (
          errorMessage.includes('Network') ||
          errorMessage.includes('fetch')
        ) {
          setLoadError(
            'Network error. Please check your connection and try again.'
          )
          toast.error('Network error while loading contest')
        } else {
          setLoadError(`Failed to load contest details: ${errorMessage}`)
          toast.error(`Failed to load contest details: ${errorMessage}`)
        }

        // Clear selected contest on error
        setSelectedContest(null)
      } finally {
        setIsLoadingContestDetails(false)
      }
    },
    [populateFormFromContest]
  )

  // Handle contest selection
  const handleSelectContest = useCallback(
    (contest: ContestDocument) => {
      setSelectedContest(contest)
      loadContestForEditing(contest.$id)
    },
    [loadContestForEditing]
  )

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  // Resolve a contest image storage object path to a displayable public URL.
  const resolveContestImageUri = (idOrPath: string | null | undefined) => {
    if (!idOrPath) return ''
    return contentPublicUrl(CONTESTS_BUCKET, idOrPath)
  }

  // Image Management Functions

  // Handle delete/restore existing image
  const handleDeleteImage = useCallback(
    (fileId: string) => {
      setImagesToDelete((prev) => {
        if (prev.includes(fileId)) {
          // Restore image (remove from delete list)
          return prev.filter((id) => id !== fileId)
        } else {
          // Check if this would be the last image
          const remainingExistingImages =
            existingImages.length - prev.length - 1
          const totalRemainingImages =
            remainingExistingImages + newGalleryAssets.length

          if (totalRemainingImages < 1) {
            toast.error(
              'Cannot delete the last image. A contest must have at least one image.'
            )
            return prev
          }

          // If marking the main image for deletion, auto-select a new main
          if (fileId === mainImageId) {
            // Find the first image that's not marked for deletion (excluding this one)
            const newDeleteList = [...prev, fileId]
            const nextMainImage = existingImages.find(
              (img) => !newDeleteList.includes(img.file_id)
            )

            if (nextMainImage) {
              setMainImageId(nextMainImage.file_id)
              setNewMainImageUri(null) // Clear new image main selection
              toast.success(
                `Main image changed to: ${nextMainImage.file_id.substring(
                  0,
                  8
                )}...`
              )
            } else if (newGalleryAssets.length > 0) {
              // If no existing images remain, use first new image
              setMainImageId(null)
              setNewMainImageUri(newGalleryAssets[0].uri)
              toast.success('First new image will become the main image')
            }
          }

          // Mark for deletion
          return [...prev, fileId]
        }
      })
    },
    [
      existingImages,
      newGalleryAssets,
      mainImageId,
      setMainImageId,
      setNewMainImageUri,
    ]
  )

  // Handle remove new image (before upload)
  const handleRemoveNewImage = useCallback(
    (uri: string) => {
      // Check if this would be the last image
      const remainingExistingImages =
        existingImages.length - imagesToDelete.length
      const remainingNewImages = newGalleryAssets.length - 1 // -1 for the one being removed
      const totalRemainingImages = remainingExistingImages + remainingNewImages

      if (totalRemainingImages < 1) {
        toast.error(
          'Cannot remove the last image. A contest must have at least one image.'
        )
        return
      }

      setNewGalleryAssets((prev) => prev.filter((asset) => asset.uri !== uri))

      // If removing the new main image, clear the selection
      if (newMainImageUri === uri) {
        setNewMainImageUri(null)
      }
    },
    [
      existingImages.length,
      imagesToDelete.length,
      newGalleryAssets.length,
      newMainImageUri,
    ]
  )

  // Handle pick images
  const handlePickImages = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== 'granted') {
        toast.error('Sorry, we need camera roll permissions to upload images.')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 1,
      })

      if (!result.canceled && result.assets) {
        const newAssets = result.assets

        // Add new assets, avoiding duplicates
        setNewGalleryAssets((prev) => {
          const merged = [...prev, ...newAssets].filter(
            (v, i, arr) => arr.findIndex((x) => x.uri === v.uri) === i
          )
          return merged
        })
      }
    } catch (error) {
      console.error('Error picking images:', error)
      toast.error('Failed to pick images. Please try again.')
    }
  }, [])

  // Host and category modal state
  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // Handle contest deletion
  const [isDeletingContest, setIsDeletingContest] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [showDeleteConfirmationError, setShowDeleteConfirmationError] =
    useState(false)

  const handleDeleteContest = async () => {
    if (!selectedContest) {
      toast.error('No contest selected')
      return
    }

    // Validate confirmation text
    const expectedText = 'Delete Contest'
    const inputText = deleteConfirmationText.trim()

    if (inputText !== expectedText) {
      setShowDeleteConfirmationError(true)
      return
    }

    // Clear error if validation passes
    setShowDeleteConfirmationError(false)
    setIsDeletingContest(true)

    try {
      await deleteSupabaseContest(selectedContest.$id)

      toast.success('Contest deleted successfully!')
      setDeleteDialogOpen(false)

      queryClient.invalidateQueries({ queryKey: ['contests'] })
      queryClient.invalidateQueries({
        queryKey: ['contest', selectedContest.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['contest', selectedContest.slug],
      })

      setSelectedContest(null)
      setSearchQuery('')
      setContests([])
      setHasSearched(false)
      reset()
      setSelectedHostIds([])
      setSelectedHostDocs([])
      setSelectedCategoryIds([])
      setSelectedCategoryDocs([])
      setExistingImages([])
      setNewGalleryAssets([])
      setImagesToDelete([])
      setMainImageId(null)
      setNewMainImageUri(null)
      setDeleteConfirmationText('')
      setShowDeleteConfirmationError(false)
    } catch (error) {
      console.error('Failed to delete contest (supabase):', error)
      toast.error(
        `Failed to delete contest: ${
          error instanceof Error ? error.message : 'An unknown error occurred'
        }`
      )
    } finally {
      setIsDeletingContest(false)
    }
    return
  }

  // Handle contest update
  const handleUpdateContest = async (data: CreateContestFormData) => {
    if (!selectedContest) {
      toast.error('No contest selected')
      return
    }

    // Show loading toast with spinner
    const loadingToastId = toast.loading('Updating contest...')

    try {
      console.log('Starting contest update...')

      await updateSupabaseContest(selectedContest.$id, data, {
        hostIds: selectedHostIds,
        categoryIds: selectedCategoryIds,
        imagesToDelete,
        newGalleryAssets,
        mainImageId,
        newMainImageUri,
        slugBase: data.slug || data.title,
      })

      toast.dismiss(loadingToastId)
      toast.success('Contest updated successfully!')

      queryClient.invalidateQueries({ queryKey: ['contests'] })
      queryClient.invalidateQueries({
        queryKey: ['contest', selectedContest.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['contest', selectedContest.slug],
      })

      setSelectedContest(null)
      setSearchQuery('')
      setContests([])
      setHasSearched(false)
      reset()
      setSelectedHostIds([])
      setSelectedHostDocs([])
      setSelectedCategoryIds([])
      setSelectedCategoryDocs([])
      setExistingImages([])
      setNewGalleryAssets([])
      setImagesToDelete([])
      setMainImageId(null)
      setNewMainImageUri(null)
      return

    } catch (error) {
      toast.dismiss(loadingToastId)
      console.error('Failed to update contest:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(`Failed to update contest: ${errorMessage}`)
    }
  }

  // Render controlled field helper (same pattern as CreateContestTabContent)
  const renderControlledField = (
    name: keyof CreateContestFormData,
    label: string,
    placeholder: string,
    component: 'input' | 'textarea' = 'input',
    isMalay: boolean = false,
    isRequired: boolean = false,
    supportsMarkdown: boolean = false,
    maxLength?: number,
    detectLineBreaks: boolean = false
  ) => {
    const Component = component === 'textarea' ? Textarea : Input
    const error = errors[name]
    const fieldValue = watch(name) as string
    const charCount = fieldValue?.length || 0
    const showCharCount = maxLength !== undefined
    const isOverLimit = maxLength !== undefined && charCount > maxLength
    const hasSuspiciousBreaks =
      detectLineBreaks &&
      component === 'textarea' &&
      detectSuspiciousLineBreaks(fieldValue)

    return (
      <View className="flex-1">
        <Label className="mb-2">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text
              className=""
              style={
                !isMalay && Platform.OS !== 'web' ? { color: main } : undefined
              }
            >
              {label}
              {isRequired && <Text className="text-red-500"> *</Text>}
            </Text>
            {supportsMarkdown && (
              <Badge
                variant="outline"
                style={
                  Platform.OS === 'web'
                    ? undefined
                    : {
                        backgroundColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.2)'
                          : 'rgba(128, 90, 213, 0.1)',
                        borderColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.4)'
                          : 'rgba(128, 90, 213, 0.3)',
                      }
                }
                className="bg-main/10 border-main/30 dark:bg-main/20 dark:border-main/40"
              >
                <Text
                  className="text-xs font-medium text-main dark:text-main"
                  style={Platform.OS === 'web' ? undefined : { color: main }}
                >
                  Markdown
                </Text>
              </Badge>
            )}
            {hasSuspiciousBreaks && (
              <Badge
                variant="outline"
                style={
                  Platform.OS === 'web'
                    ? undefined
                    : {
                        backgroundColor: isDarkColorScheme
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(245, 158, 11, 0.1)',
                        borderColor: isDarkColorScheme
                          ? 'rgba(245, 158, 11, 0.4)'
                          : 'rgba(245, 158, 11, 0.3)',
                      }
                }
                className="bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/20 dark:border-amber-500/40"
              >
                <Text
                  className="text-xs font-medium text-amber-600 dark:text-amber-400"
                  style={
                    Platform.OS === 'web'
                      ? undefined
                      : { color: isDarkColorScheme ? '#fbbf24' : '#d97706' }
                  }
                >
                  ⚠️ Line Breaks
                </Text>
              </Badge>
            )}
          </View>
        </Label>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, value } }) => (
            <Component
              placeholder={placeholder}
              value={value as string}
              onChangeText={onChange}
              multiline={component === 'textarea'}
              scrollEnabled={!isExpandedMode}
              style={
                component === 'textarea'
                  ? isExpandedMode
                    ? { minHeight: 300, maxHeight: 600 }
                    : { height: 80 }
                  : undefined
              }
              className={
                !isMalay
                  ? `${ENGLISH_INPUT_CLASSNAME} ${
                      Platform.OS === 'web' ? 'dark:border-main' : ''
                    }`
                  : undefined
              }
              autoCapitalize="none"
              {...(maxLength !== undefined ? { maxLength } : {})}
            />
          )}
        />
        {showCharCount && (
          <Text
            className={`text-xs mt-1 text-right ${
              isOverLimit
                ? 'text-red-500 dark:text-red-400'
                : charCount > maxLength * 0.9
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-muted-foreground'
            }`}
          >
            {charCount}/{maxLength}
          </Text>
        )}
        {error && (
          <Text className="text-red-500 text-sm mt-1">
            {error.message as string}
          </Text>
        )}
      </View>
    )
  }

  // Render locale field pair helper (same pattern as CreateContestTabContent)
  const renderLocaleFieldPair = (
    keyEn: keyof CreateContestFormData,
    keyMs: keyof CreateContestFormData,
    label: string,
    placeholderEn: string,
    placeholderMs: string,
    component: 'input' | 'textarea' = 'input',
    isRequired: boolean = false,
    supportsMarkdown: boolean = false,
    maxLength?: number,
    detectLineBreaks: boolean = false
  ) => {
    return (
      <View className="mt-4 w-full">
        {isDesktopLayout ? (
          <View className="flex-row gap-4">
            <View className="flex-1" style={{ minWidth: 0 }}>
              {renderControlledField(
                keyEn,
                `${label} (English)`,
                placeholderEn,
                component,
                false,
                isRequired,
                supportsMarkdown,
                maxLength,
                detectLineBreaks
              )}
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
              {renderControlledField(
                keyMs,
                `${label} (Malay)`,
                placeholderMs,
                component,
                true,
                false,
                supportsMarkdown,
                maxLength,
                detectLineBreaks
              )}
            </View>
          </View>
        ) : (
          <View className="gap-3">
            {renderControlledField(
              keyEn,
              `${label} (English)`,
              placeholderEn,
              component,
              false,
              isRequired,
              supportsMarkdown,
              maxLength,
              detectLineBreaks
            )}
            {renderControlledField(
              keyMs,
              `${label} (Malay)`,
              placeholderMs,
              component,
              true,
              false,
              supportsMarkdown,
              maxLength,
              detectLineBreaks
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingBottom: 48,
        }}
        className="p-4"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <Text
          className="text-2xl font-bold mb-4"
          style={Platform.OS === 'web' ? undefined : { color: main }}
        >
          Edit Contest
        </Text>

        <View
          className="w-full gap-4"
          style={{
            width: '100%',
            maxWidth: containerMaxWidth,
            alignSelf: 'center',
          }}
        >
          {/* Search Interface */}
          <View className="w-full gap-3">
            <Label>Search for a contest</Label>

            {/* Search Mode Selector */}
            <View className="flex-row gap-3 mb-2">
              <Pressable
                onPress={() => {
                  setSearchMode('title')
                  setSearchError(null)
                  if (searchQuery.trim()) {
                    setContests([])
                    setHasSearched(false)
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                  searchMode === 'title'
                    ? Platform.OS === 'web'
                      ? 'border-main bg-main/10'
                      : 'border-2'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                style={({ pressed }) => ({
                  ...(searchMode === 'title' && Platform.OS !== 'web'
                    ? { borderColor: main, backgroundColor: main + '1A' }
                    : {}),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  className={`text-center font-medium ${
                    searchMode === 'title'
                      ? ''
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  style={
                    searchMode === 'title' && Platform.OS !== 'web'
                      ? { color: main }
                      : undefined
                  }
                >
                  By Title / Slug / Host
                </Text>
                <Text className="text-xs text-center text-gray-500 mt-1">
                  (Fuzzy search)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setSearchMode('slug')
                  setSearchError(null)
                  if (searchQuery.trim()) {
                    setContests([])
                    setHasSearched(false)
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                  searchMode === 'slug'
                    ? Platform.OS === 'web'
                      ? 'border-main bg-main/10'
                      : 'border-2'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                style={({ pressed }) => ({
                  ...(searchMode === 'slug' && Platform.OS !== 'web'
                    ? { borderColor: main, backgroundColor: main + '1A' }
                    : {}),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  className={`text-center font-medium ${
                    searchMode === 'slug'
                      ? ''
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  style={
                    searchMode === 'slug' && Platform.OS !== 'web'
                      ? { color: main }
                      : undefined
                  }
                >
                  By Slug
                </Text>
                <Text className="text-xs text-center text-gray-500 mt-1">
                  (Exact match)
                </Text>
              </Pressable>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  placeholder={
                    searchMode === 'slug'
                      ? 'Paste slug or URL...'
                      : 'Enter title, slug, or host name...'
                  }
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  onSubmitEditing={handleManualSearch}
                />
              </View>
              <Button
                onPress={handleManualSearch}
                disabled={isLoadingContests || !searchQuery.trim()}
                className="px-4"
              >
                <Text>Search</Text>
              </Button>
            </View>
            {searchError && (
              <View className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <Text className="text-sm text-red-600 dark:text-red-400">
                  {searchError}
                </Text>
              </View>
            )}
          </View>

          {/* Contest List */}
          {isLoadingContests && (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" />
              <Text className="mt-2 text-gray-500">Searching contests...</Text>
            </View>
          )}

          {!isLoadingContests &&
            hasSearched &&
            contests.length === 0 &&
            !searchError && (
              <View className="py-8 items-center">
                <Text className="text-gray-500">
                  {searchMode === 'slug'
                    ? 'No contest found with that exact slug.'
                    : 'No contests found. Try a different search term.'}
                </Text>
              </View>
            )}

          {!isLoadingContests && contests.length > 0 && (
            <View className="w-full gap-2">
              <Label>Search Results ({contests.length})</Label>
              <View className="gap-2">
                {contests.map((contest) => {
                  const mainImageUri = contest.main_img_id
                    ? resolveContestImageUri(contest.main_img_id)
                    : null

                  return (
                    <Pressable
                      key={contest.$id}
                      onPress={() => handleSelectContest(contest)}
                      className={`rounded-lg border ${
                        selectedContest?.$id === contest.$id
                          ? 'border-main bg-main/10'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View className="flex-row gap-3 p-4">
                        {/* Main Image Thumbnail */}
                        {mainImageUri && (
                          <ExpoImage
                            source={{ uri: mainImageUri }}
                            style={{
                              width: 80,
                              height: 80,
                              borderRadius: 8,
                            }}
                            contentFit="cover"
                            placeholder={{
                              blurhash:
                                contest.main_img_blurhash || DEFAULT_BLURHASH,
                            }}
                          />
                        )}

                        {/* Contest Info */}
                        <View className="flex-1">
                          <Text className="font-semibold text-base mb-1">
                            {contest.title}
                          </Text>

                          {/* Host Names */}
                          {(() => {
                            const hosts = contestHosts[contest.$id]
                            if (hosts && hosts.length > 0) {
                              return (
                                <View className="flex-row flex-wrap gap-1 mb-1">
                                  {hosts.map((host, idx) => (
                                    <View
                                      key={host.$id}
                                      className="flex-row items-center"
                                    >
                                      <Text className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                        {host.name}
                                      </Text>
                                      {idx < hosts.length - 1 && (
                                        <Text className="text-sm text-gray-400 mx-1">
                                          •
                                        </Text>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )
                            }
                            return null
                          })()}

                          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Slug: {contest.slug}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            {formatDate(contest.start_date)} -{' '}
                            {formatDate(contest.end_date)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}

          {/* Separator after search results */}
          {contests.length > 0 && (
            <View className="w-full my-4">
              <Separator />
            </View>
          )}

          {/* Loading Contest Details */}
          {isLoadingContestDetails && (
            <View className="w-full py-8 items-center gap-3">
              <ActivityIndicator size="large" />
              <Text className="mt-2 text-gray-500">
                Loading contest details...
              </Text>
              <Text className="text-xs text-gray-400">
                Fetching contest data, translations, images, hosts, and
                categories
              </Text>
            </View>
          )}

          {/* Load Error Display */}
          {loadError && !isLoadingContestDetails && (
            <View className="w-full p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <Text className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">
                Failed to Load Contest
              </Text>
              <Text className="text-sm text-red-600 dark:text-red-400 mb-3">
                {loadError}
              </Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setLoadError(null)
                  setSearchQuery('')
                  setContests([])
                  setHasSearched(false)
                }}
              >
                <Text>Back to Search</Text>
              </Button>
            </View>
          )}

          {/* Selected Contest - Loaded */}
          {selectedContest && !isLoadingContestDetails && (
            <View className="w-full p-4 rounded-lg border border-main bg-main/5">
              <View className="flex-row gap-3">
                {/* Main Image Thumbnail */}
                {selectedContest.main_img_id && (
                  <ExpoImage
                    source={{
                      uri: resolveContestImageUri(selectedContest.main_img_id),
                    }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                    }}
                    contentFit="cover"
                    placeholder={{
                      blurhash:
                        selectedContest.main_img_blurhash || DEFAULT_BLURHASH,
                    }}
                  />
                )}

                {/* Contest Info */}
                <View className="flex-1">
                  <Text className="font-semibold text-lg mb-2">
                    Selected: {selectedContest.title}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Contest loaded successfully! Form fields have been
                    populated.
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Hosts: {selectedHostDocs.length} | Categories:{' '}
                    {selectedCategoryDocs.length} | Images:{' '}
                    {existingImages.length}
                  </Text>
                </View>
              </View>

              {/* Cancel Selection Button */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onPress={() => {
                  setSelectedContest(null)
                  reset()
                  setSelectedHostIds([])
                  setSelectedHostDocs([])
                  setSelectedCategoryIds([])
                  setSelectedCategoryDocs([])
                  setExistingImages([])
                  setNewGalleryAssets([])
                  setImagesToDelete([])
                  setMainImageId(null)
                  setNewMainImageUri(null)
                  toast.success('Selection cleared')
                }}
              >
                <Text>Cancel Selection</Text>
              </Button>
            </View>
          )}

          {/* Editable Form - Only show when contest is selected and loaded */}
          {selectedContest && !isLoadingContestDetails && (
            <View className="w-full mt-6 gap-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className="text-xl font-bold"
                  style={Platform.OS === 'web' ? undefined : { color: main }}
                >
                  Edit Contest Details
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-3 py-1"
                  onPress={() => setIsExpandedMode(!isExpandedMode)}
                >
                  <Text className="text-xs font-semibold">
                    {isExpandedMode
                      ? '📋 Collapse Fields'
                      : '📖 Expand All Fields'}
                  </Text>
                </Button>
              </View>

              {/* Host Selection */}
              <View className="w-full">
                <Label className="mb-2">
                  Host(s)<Text className="text-red-500"> *</Text>
                  {Platform.OS === 'web' && selectedHostDocs.length > 1 && (
                    <Text className="text-xs text-gray-500 ml-2">
                      (Drag to reorder)
                    </Text>
                  )}
                </Label>
                {selectedHostDocs.length > 0 ? (
                  <View className="flex-row flex-wrap mb-2">
                    {selectedHostDocs.map((h, index) => (
                      <DraggableHostBadge
                        key={h.$id}
                        host={h}
                        index={index}
                        instanceId={hostInstanceId}
                        onRemove={() => {
                          setSelectedHostIds((prev) =>
                            prev.filter((id) => id !== h.$id)
                          )
                          setSelectedHostDocs((prev) =>
                            prev.filter((doc) => doc.$id !== h.$id)
                          )
                        }}
                        onReorder={handleHostReorder}
                      />
                    ))}
                  </View>
                ) : (
                  <Text className="mb-2">No hosts selected</Text>
                )}
                <Button
                  variant="secondary"
                  onPress={() => setHostModalOpen(true)}
                >
                  <Text>Select / Manage Hosts</Text>
                </Button>
              </View>

              {/* Category Selection */}
              <View className="w-full">
                <Label className="mb-2">
                  Category(s)<Text className="text-red-500"> *</Text>
                  {Platform.OS === 'web' && selectedCategoryDocs.length > 1 && (
                    <Text className="text-xs text-gray-500 ml-2">
                      (Drag to reorder)
                    </Text>
                  )}
                </Label>
                {selectedCategoryDocs.length > 0 ? (
                  <View className="flex-row flex-wrap mb-2">
                    {selectedCategoryDocs.map((c, index) => (
                      <DraggableCategoryBadge
                        key={c.$id}
                        category={c}
                        index={index}
                        instanceId={categoryInstanceId}
                        onRemove={() => {
                          setSelectedCategoryIds((prev) =>
                            prev.filter((id) => id !== c.$id)
                          )
                          setSelectedCategoryDocs((prev) =>
                            prev.filter((doc) => doc.$id !== c.$id)
                          )
                        }}
                        onReorder={handleCategoryReorder}
                      />
                    ))}
                  </View>
                ) : (
                  <Text className="mb-2">No categories selected</Text>
                )}
                <Button
                  variant="secondary"
                  onPress={() => setCategoryModalOpen(true)}
                >
                  <Text>Select / Manage Categories</Text>
                </Button>
              </View>

              {/* Visibility */}
              <View className="mt-4">
                <Label className="mb-2">Visibility</Label>
                <Controller
                  control={control}
                  name="visibility"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      value={{
                        value: value || 'users',
                        label:
                          value === 'any'
                            ? 'Any (Public)'
                            : value === 'admin'
                            ? 'Admin Only'
                            : 'Users (Logged-in)',
                      }}
                      onValueChange={(option) => {
                        onChange(option?.value || 'users')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="users" label="Users (Logged-in)">
                          Users (Logged-in)
                        </SelectItem>
                        <SelectItem value="any" label="Any (Public)">
                          Any (Public)
                        </SelectItem>
                        <SelectItem value="admin" label="Admin Only">
                          Admin Only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <Text className="text-xs text-muted-foreground mt-1">
                  Users = logged-in users only | Any = everyone including
                  non-logged-in | Admin = admins only
                </Text>
              </View>

              {/* Contest Images */}
              <Label>
                Contest Images<Text className="text-red-500"> *</Text>
              </Label>

              {/* Existing Images */}
              {existingImages.length > 0 && (
                <View className="w-full mb-4">
                  <Label className="mb-2">
                    Existing Images ({existingImages.length})
                  </Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                  >
                    {existingImages.map((img) => {
                      const isMarkedForDeletion = imagesToDelete.includes(
                        img.file_id
                      )
                      const isMainImage = img.file_id === mainImageId
                      const imageUri = resolveContestImageUri(img.file_id)

                      return (
                        <View
                          key={img.$id}
                          className={`relative ${
                            isMarkedForDeletion ? 'opacity-50' : ''
                          }`}
                        >
                          <ExpoImage
                            source={{ uri: imageUri }}
                            style={{
                              width: 120,
                              height: 120,
                              borderRadius: 8,
                            }}
                            contentFit="cover"
                            placeholder={{
                              blurhash: img.img_blurhash || DEFAULT_BLURHASH,
                            }}
                          />

                          {/* Main Image Badge */}
                          {isMainImage && !isMarkedForDeletion && (
                            <View className="absolute top-2 left-2 bg-main px-2 py-1 rounded">
                              <Text className="text-white text-xs font-semibold">
                                Main
                              </Text>
                            </View>
                          )}

                          {/* Marked for Deletion Badge */}
                          {isMarkedForDeletion && (
                            <View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded">
                              <Text className="text-white text-xs font-semibold">
                                Will Delete
                              </Text>
                            </View>
                          )}

                          {/* Delete/Restore Button */}
                          <Pressable
                            onPress={() => handleDeleteImage(img.file_id)}
                            style={({ pressed }) => ({
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: isMarkedForDeletion
                                ? '#22c55e'
                                : '#ef4444',
                              borderRadius: 9999,
                              width: 24,
                              height: 24,
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text className="text-white text-sm font-bold">
                              {isMarkedForDeletion ? '↺' : '×'}
                            </Text>
                          </Pressable>

                          {/* Set as Main Button */}
                          {!isMainImage && !isMarkedForDeletion && (
                            <Pressable
                              onPress={() => {
                                setMainImageId(img.file_id)
                                setNewMainImageUri(null) // Clear new image main selection
                              }}
                              style={({ pressed }) => ({
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                right: 8,
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                paddingVertical: 4,
                                borderRadius: 4,
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Text className="text-white text-xs text-center">
                                Set as Main
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* New Images Preview */}
              {newGalleryAssets.length > 0 && (
                <View className="w-full mb-4">
                  <Label className="mb-2">
                    New Images ({newGalleryAssets.length})
                  </Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                  >
                    {newGalleryAssets.map((asset, idx) => {
                      const isNewMain = newMainImageUri === asset.uri
                      return (
                        <View
                          key={`new-${asset.uri}-${idx}`}
                          className="relative"
                        >
                          <ExpoImage
                            source={{ uri: asset.uri }}
                            style={{
                              width: 120,
                              height: 120,
                              borderRadius: 8,
                            }}
                            contentFit="cover"
                          />

                          {/* New Badge or Main Badge */}
                          <View
                            className={`absolute top-2 left-2 px-2 py-1 rounded ${
                              isNewMain ? 'bg-main' : 'bg-green-500'
                            }`}
                          >
                            <Text className="text-white text-xs font-semibold">
                              {isNewMain ? 'New Main' : 'New'}
                            </Text>
                          </View>

                          {/* Remove Button */}
                          <Pressable
                            onPress={() => handleRemoveNewImage(asset.uri)}
                            style={({ pressed }) => ({
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: '#ef4444',
                              borderRadius: 9999,
                              width: 24,
                              height: 24,
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text className="text-white text-sm font-bold">
                              ×
                            </Text>
                          </Pressable>

                          {/* Set as Main Button */}
                          {!isNewMain && (
                            <Pressable
                              onPress={() => {
                                setNewMainImageUri(asset.uri)
                                setMainImageId(null) // Clear existing main selection
                              }}
                              style={({ pressed }) => ({
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                right: 8,
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                paddingVertical: 4,
                                borderRadius: 4,
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Text className="text-white text-xs text-center">
                                Set as Main
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Add Images Button */}
              <Button
                variant="secondary"
                onPress={handlePickImages}
                className="w-full"
              >
                <Text>
                  {newGalleryAssets.length > 0
                    ? 'Add More Images'
                    : 'Add Images'}
                </Text>
              </Button>

              {existingImages.length === 0 && newGalleryAssets.length === 0 && (
                <Text className="text-sm text-gray-500 mt-2 text-center">
                  No images yet. Add at least one image for the contest.
                </Text>
              )}

              {/* Basic Contest Info */}
              {renderLocaleFieldPair(
                'title',
                'title_ms',
                'Title',
                'Title',
                'Tajuk (BM)',
                'input',
                true,
                false,
                100
              )}
              {renderLocaleFieldPair(
                'summary',
                'summary_ms',
                'Summary',
                'Summary',
                'Ringkasan (BM)',
                'textarea',
                true,
                false,
                200
              )}

              {/* Date Pickers */}
              <View className="w-full">
                <Label className="mb-2">
                  Start Date<Text className="text-red-500"> *</Text>
                </Label>
                <Controller
                  control={control}
                  name="start_date"
                  render={({ field: { onChange, value } }) =>
                    Platform.OS === 'web' ? (
                      <SingleDateTimePicker
                        value={value}
                        onChange={onChange}
                        placeholder="Select start date"
                      />
                    ) : (
                      <SingleDateTimePickerMobile
                        value={value}
                        onChange={onChange}
                        placeholder="Select start date"
                      />
                    )
                  }
                />
                {errors.start_date && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.start_date.message}
                  </Text>
                )}
              </View>

              <View className="w-full">
                <Label className="mb-2">
                  End Date<Text className="text-red-500"> *</Text>
                </Label>
                <Controller
                  control={control}
                  name="end_date"
                  render={({ field: { onChange, value } }) =>
                    Platform.OS === 'web' ? (
                      <SingleDateTimePicker
                        value={value}
                        onChange={onChange}
                        placeholder="Select end date"
                      />
                    ) : (
                      <SingleDateTimePickerMobile
                        value={value}
                        onChange={onChange}
                        placeholder="Select end date"
                      />
                    )
                  }
                />
                {errors.end_date && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.end_date.message}
                  </Text>
                )}
              </View>

              {/* Slug */}
              <View className="w-full">
                <View className="flex-row items-center gap-2 mb-2">
                  <Label>
                    Slug<Text className="text-red-500"> *</Text>
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onPress={generateSlug}
                  >
                    <Text>Regenerate</Text>
                  </Button>
                </View>
                <Controller
                  control={control}
                  name="slug"
                  render={({ field: { onChange, value } }) => {
                    const charCount = value?.length || 0
                    const maxLength = 200
                    const isOverLimit = charCount > maxLength
                    return (
                      <View>
                        <Input
                          placeholder="contest-slug"
                          value={value}
                          onChangeText={onChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                          multiline={true}
                          numberOfLines={2}
                          className="h-16 py-2"
                          {...(maxLength !== undefined ? { maxLength } : {})}
                        />
                        <Text
                          className={`text-xs mt-1 text-right ${
                            isOverLimit
                              ? 'text-red-500 dark:text-red-400'
                              : charCount > maxLength * 0.9
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {charCount}/{maxLength}
                        </Text>
                      </View>
                    )
                  }}
                />
                {errors.slug && (
                  <Text className="text-red-500 text-sm mt-1">
                    {errors.slug.message as string}
                  </Text>
                )}
              </View>

              {/* Total Prizes Value */}
              {renderControlledField(
                'total_prizes_value_rm',
                'Total Prizes Value (RM)',
                '10000.50'
              )}

              {/* Affiliate Links */}
              <Text className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">
                Affiliate Links
              </Text>
              {renderControlledField(
                'link_aff_shopee',
                'Shopee Affiliate Link',
                'https://shopee.com.my/...',
                'input',
                false,
                false,
                false,
                1000
              )}
              {renderControlledField(
                'link_aff_lazada',
                'Lazada Affiliate Link',
                'https://www.lazada.com.my/...',
                'input',
                false,
                false,
                false,
                1000
              )}
              {renderControlledField(
                'link_aff_tiktok_shop',
                'TikTok Shop Affiliate Link',
                'https://www.tiktok.com/...',
                'input',
                false,
                false,
                false,
                1000
              )}

              {/* Social Media Links */}
              <Text className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">
                Social Media Links
              </Text>
              {renderControlledField(
                'link_media_instagram',
                'Instagram Post Link',
                'https://www.instagram.com/p/...',
                'input',
                false,
                false,
                false,
                400
              )}
              {renderControlledField(
                'link_media_facebook',
                'Facebook Post Link',
                'https://www.facebook.com/...',
                'input',
                false,
                false,
                false,
                400
              )}
              {renderControlledField(
                'link_media_tiktok',
                'TikTok Post Link',
                'https://www.tiktok.com/@.../video/...',
                'input',
                false,
                false,
                false,
                200
              )}
              {renderControlledField(
                'link_media_x',
                'X (Twitter) Post Link',
                'https://x.com/.../status/...',
                'input',
                false,
                false,
                false,
                200
              )}
              {renderControlledField(
                'link_media_youtube',
                'YouTube Video Link',
                'https://www.youtube.com/watch?v=...',
                'input',
                false,
                false,
                false,
                200
              )}
              {renderControlledField(
                'link_media_linkedin',
                'LinkedIn Post Link',
                'https://www.linkedin.com/posts/...',
                'input',
                false,
                false,
                false,
                400
              )}
              {renderControlledField(
                'link_media_website',
                'Website Link',
                'https://example.com/contest',
                'input',
                false,
                false,
                false,
                400
              )}

              {/* Translation Fields */}
              <Text className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">
                Contest Details (Translations)
              </Text>

              <View
                className="mt-2 mb-4 px-3 py-2 bg-main/5 dark:bg-main/10 rounded-md border border-main/20 dark:border-main/30"
                style={
                  Platform.OS === 'web'
                    ? undefined
                    : {
                        backgroundColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.1)'
                          : 'rgba(128, 90, 213, 0.05)',
                        borderColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.3)'
                          : 'rgba(128, 90, 213, 0.2)',
                      }
                }
              >
                <Text
                  className="text-xs text-main dark:text-main"
                  style={Platform.OS === 'web' ? undefined : { color: main }}
                >
                  💡 Tip: Fields marked with "Markdown" badge support markdown
                  formatting:
                  {'\n'}→ **bold text**
                  {'\n'}→ *italic text* or _italic text_
                  {'\n'}→ [Link Text](https://example.com)
                  {'\n'}→ [Internal Link](/page)
                  {'\n'}→ - bullet list or * bullet list
                  {'\n'}→ 1. numbered list
                  {'\n'}→ | Col1 | Col2 | for tables
                  {'\n'}→ # ## ### #### for headings
                  {'\n'}→ --- for horizontal rule
                </Text>
              </View>

              {renderLocaleFieldPair(
                'eligible_participants_en',
                'eligible_participants_ms',
                'Eligible Participants',
                'Open to all residents...',
                'Terbuka kepada semua penduduk...',
                'textarea',
                true,
                true,
                1500,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'eligible_participants_exclusion_en',
                'eligible_participants_exclusion_ms',
                'Eligible Participants Exclusion',
                'Who cannot participate',
                'Siapa yang tidak boleh menyertai',
                'textarea',
                false,
                true,
                1000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'eligible_products_en',
                'eligible_products_ms',
                'Eligible Products & Purchases',
                'Eligible products and purchase requirements',
                'Produk layak dan keperluan pembelian',
                'textarea',
                true,
                true,
                2400,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'eligible_stores_en',
                'eligible_stores_ms',
                'Eligible Stores',
                'Eligible stores or locations',
                'Kedai atau lokasi yang layak',
                'textarea',
                true,
                true,
                2000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'prizes_en',
                'prizes_ms',
                'Prizes & Prizes Limit',
                'Prize details and prizes limit in English',
                'Maklumat hadiah dan had hadiah dalam Bahasa Melayu',
                'textarea',
                true,
                true,
                2000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'entry_method_en',
                'entry_method_ms',
                'Entry Method & Submission',
                'How to enter and submit',
                'Cara untuk menyertai dan menghantar',
                'textarea',
                true,
                true,
                2000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'winners_selection_method_en',
                'winners_selection_method_ms',
                'Winners Selection Method',
                'How winners will be selected',
                'Bagaimana pemenang akan dipilih',
                'textarea',
                true,
                true,
                2000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'winners_comm_and_timeline_en',
                'winners_comm_and_timeline_ms',
                'Winners Communication Channel & Timeline',
                'How and when winners will be contacted and announced',
                'Bagaimana dan bila pemenang akan dihubungi dan diumumkan',
                'textarea',
                true,
                true,
                1500,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'winners_list_and_announcement_en',
                'winners_list_and_announcement_ms',
                'Winners List and Announcement',
                'Additional winner information and announcement details',
                'Maklumat tambahan pemenang dan pengumuman',
                'textarea',
                true,
                true,
                1000,
                true // Enable line break detection
              )}

              {renderLocaleFieldPair(
                'link_tnc_en',
                'link_tnc_ms',
                'Terms & Conditions Link',
                'https://example.com/tnc',
                'https://example.com/terma-syarat',
                'input',
                false,
                false,
                300
              )}

              {renderLocaleFieldPair(
                'link_faq_en',
                'link_faq_ms',
                'FAQ Link',
                'https://example.com/faq',
                'https://example.com/soalan-lazim',
                'input',
                false,
                false,
                300
              )}

              {/* Update Contest Button */}
              <View className="w-full mt-8 mb-4">
                <Button
                  onPress={handleSubmit(handleUpdateContest)}
                  disabled={isSubmitting}
                  className="w-full bg-main"
                  size="lg"
                >
                  {isSubmitting ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator size="small" color={mainForeground} />
                      <Text>Updating Contest...</Text>
                    </View>
                  ) : (
                    <Text>Update Contest</Text>
                  )}
                </Button>
              </View>

              {/* Delete Contest Section */}
              <View className="w-full mt-8 mb-4">
                <Separator className="mb-6" />
                <Text className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Deleting a contest is permanent and cannot be undone. This
                  will remove:
                </Text>
                <View className="ml-4 mb-4">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • All contest images and files
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • All translations (English and Malay)
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • All user upvotes for this contest
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • All user saves/bookmarks for this contest
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • All user uploaded receipts for this contest (archived)
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    • The contest from search index
                  </Text>
                </View>
                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      size="lg"
                      disabled={isDeletingContest}
                    >
                      {isDeletingContest ? (
                        <View className="flex-row items-center gap-2">
                          <ActivityIndicator size="small" color="#fff" />
                          <Text>Deleting Contest...</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-2">
                          <TrashOutline
                            width={20}
                            height={20}
                            color="white"
                            strokeWidth={1.5}
                          />
                          <Text>Delete Contest</Text>
                        </View>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Contest?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{selectedContest?.title}".
                        This action cannot be undone. All images, translations,
                        user upvotes, user saves, and associated data will be
                        removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <View className="py-4">
                      <Label className="mb-2">
                        Type "Delete Contest" to confirm
                      </Label>
                      <Input
                        placeholder="Delete Contest"
                        value={deleteConfirmationText}
                        onChangeText={(text) => {
                          setDeleteConfirmationText(text)
                          // Clear error when user starts typing again
                          if (showDeleteConfirmationError) {
                            setShowDeleteConfirmationError(false)
                          }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {showDeleteConfirmationError && (
                        <Text className="text-xs text-red-500 dark:text-red-400 mt-1">
                          Please type "Delete Contest" exactly as shown
                        </Text>
                      )}
                    </View>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onPress={() => {
                          setDeleteDialogOpen(false)
                          setDeleteConfirmationText('')
                          setShowDeleteConfirmationError(false)
                        }}
                      >
                        <Text>Cancel</Text>
                      </AlertDialogCancel>
                      <Button
                        onPress={handleDeleteContest}
                        className="bg-red-500"
                        disabled={isDeletingContest}
                      >
                        {isDeletingContest ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text className="text-white">Confirm Delete</Text>
                        )}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </View>
            </View>
          )}
        </View>

        {/* Host Manager Modal */}
        <HostManagerModal
          visible={hostModalOpen}
          onRequestClose={() => setHostModalOpen(false)}
          selectedHostIds={selectedHostIds}
          onChangeSelection={(ids, docs) => {
            setSelectedHostIds(ids)
            setSelectedHostDocs(docs)
          }}
        />

        {/* Category Manager Modal */}
        <CategoryManagerModal
          visible={categoryModalOpen}
          onRequestClose={() => setCategoryModalOpen(false)}
          selectedCategoryIds={selectedCategoryIds}
          onChangeSelection={(ids, docs) => {
            setSelectedCategoryIds(ids)
            setSelectedCategoryDocs(docs)
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
