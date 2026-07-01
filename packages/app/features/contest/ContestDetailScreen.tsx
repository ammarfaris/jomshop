import { useState, useEffect, useMemo, useRef } from 'react'
import { View, ScrollView, Platform, Dimensions, Pressable } from 'react-native'
import { useRouteParams } from 'app/hooks/useRouteParams'
import { useQuery } from '@tanstack/react-query'
import type { Document } from 'app/lib/types'
import dayjs from 'dayjs'

import { Text } from 'app/components/ui/text'
import { MarkdownText } from 'app/components/MarkdownText'
import { ImageGallery, ImageItem } from 'app/components/gallery/ImageGallery'
import { GalleryThumbnail } from 'app/components/gallery/GalleryThumbnail'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useAuth } from 'app/contexts/AuthContext'
import { Trans, useLingui, Plural } from '@lingui/react/macro'
import { Link } from 'app/lib/link-universal'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'app/components/ui/popover'

import { Skeleton } from 'app/components/ui/skeleton'
import { Badge } from 'app/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'app/components/ui/card'
import { Separator } from 'app/components/ui/separator'
import { ContestActionsMenu } from 'app/features/contest/components/ContestActionsMenu'
import { UpvoteButton } from 'app/components/UpvoteButton'
import { SaveButton } from 'app/components/SaveButton'
import { ShareButton } from 'app/components/ShareButton'
import { useContestReceiptCount } from 'app/hooks/useReceipts'
import ReceiptManagerModal from 'app/features/profile/components/ReceiptManagerModal'
import {
  InstagramSolid,
  FacebookSolid,
  TikTokSolid,
  XSolid,
  YouTubeSolid,
  LinkedInSolid,
  GlobeAltOutline,
} from 'app/components/icons-svg'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useIsAdmin } from 'app/hooks/useIsAdmin'
import { HostImage } from 'app/components/HostImage'
import { AdBanner, AdBannerPlaceholder } from 'app/components/AdBanner'
import { usePublicContestBySlug } from 'app/hooks/usePublicContests'
import { getUserPrefs } from 'app/lib/prefs'
import { Button } from 'app/components/ui/button'
import { useRouter } from 'app/lib/router-universal'

// AdSense configuration
const ADSENSE_PUBLISHER_ID = 'ca-pub-3985532721810420' // JomContest publisher ID
const ADSENSE_SLOT_ID = '' // TODO: Create an ad unit in AdSense and add the slot ID here
const AD_TEST_MODE = __DEV__ // Enable test mode in development
// Only show ads when we have a valid slot ID and AdSense is configured properly
const SHOW_ADS =
  Boolean(ADSENSE_SLOT_ID) && !ADSENSE_PUBLISHER_ID.includes('XXXX')

// Define types
type Contest = Document & {
  title: string
  slug: string
  summary: string
  start_date: string
  end_date: string
  main_img_id?: string
  main_img_token_secret?: string
  main_img_blurhash?: string
  category_ids?: string[]
  host_ids?: string[]
  title_ms?: string
  summary_ms?: string
  total_prizes_value_rm?: number
  link_aff_shopee?: string
  link_aff_lazada?: string
  link_aff_tiktok_shop?: string
  link_media_instagram?: string
  link_media_facebook?: string
  link_media_tiktok?: string
  link_media_x?: string
  link_media_youtube?: string
  link_media_linkedin?: string
  link_media_website?: string
  visibility?: 'any' | 'users' | 'admin'
}

type ContestFile = Document & {
  file_id: string
  contest_id: string
  token_secret: string
  img_blurhash?: string
  file_order: number
}

// Host type for contest hosts
type Host = Document & {
  name: string
  slug: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash?: string
  bio?: string
}

type Category = Document & {
  slug: string
  name_en: string
  name_ms?: string | null
  priority_order?: number | null
  type?:
    | 'prize'
    | 'winner_selection'
    | 'how_to_enter'
    | 'business_category'
    | null
}

const useContestDetailParams = useRouteParams<{ id: string }>

// Accept contestId as a prop, or fallback to route param
export default function ContestDetailScreen({
  contestId,
}: {
  contestId?: string
}) {
  const { t } = useLingui()
  // Use the provided contestId prop if available, otherwise fallback to route param
  const params = useContestDetailParams()
  const id = contestId ?? params?.id ?? ''
  const { top, bottom } = useSafeArea()
  const { user, isLoading: isLoadingUser } = useAuth()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin()
  const { isDarkColorScheme } = useColorScheme()

  const { main } = useColorThemeValues(isDarkColorScheme)
  const router = useRouter()

  const [galleryVisible, setGalleryVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [receiptModalVisible, setReceiptModalVisible] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [actionButtonsY, setActionButtonsY] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)

  // Calculate image height for consistent sizing
  const { width: screenWidth } = Dimensions.get('window')
  const imageHeight = Math.min(screenWidth * 0.75, 400)

  // Web-specific scroll handler
  useEffect(() => {
    if (Platform.OS !== 'web') return

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset

      if (actionButtonsY > 0) {
        const viewportHeight = window.innerHeight
        // Fixed header is 157px. Buttons are ~50px high.
        // We want to hide menu when buttons are visible (below header).
        // Adjusted based on testing, slightly more than native (native is -20)
        const threshold = -25

        // Calculate if action buttons are visible in viewport
        const buttonsPositionInViewport = actionButtonsY - scrollY
        const isButtonsVisible =
          buttonsPositionInViewport > threshold &&
          buttonsPositionInViewport < viewportHeight

        setShowActionsMenu(!isButtonsVisible)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [actionButtonsY])

  // Native scroll handler
  const handleNativeScroll = (event: any) => {
    if (Platform.OS === 'web') return

    const scrollY = event.nativeEvent.contentOffset.y

    if (actionButtonsY > 0) {
      const viewportHeight = Dimensions.get('window').height

      // Native: Ad is outside scroll view.
      // actionButtonsY is relative to content top (0).
      // Buttons hidden when scrolled up past top edge (0).
      // To make it appear earlier (when buttons just disappearing), use smaller negative.
      // To make it appear later (when buttons fully gone), use larger negative.
      // User said "appears slightly late" -> show SOONER -> less negative.
      const threshold = -20
      const buttonsPositionInViewport = actionButtonsY - scrollY
      const isButtonsVisible =
        buttonsPositionInViewport > threshold &&
        buttonsPositionInViewport < viewportHeight

      setShowActionsMenu(!isButtonsVisible)
    }
  }

  // Contest detail via Supabase public RLS (works for anon + signed-in; premium
  // translation fields + affiliate links are gated server-side inside the fetch).
  const {
    data: publicContestData,
    isLoading: isLoadingPublicContest,
    isError: isErrorPublicContest,
  } = usePublicContestBySlug(id || '', !isLoadingUser && !!id)

  // Unified contest data
  const contest = useMemo(
    () => publicContestData?.contest as unknown as Contest | undefined,
    [publicContestData?.contest],
  )

  const isLoadingContest = isLoadingPublicContest
  const isErrorContest = isErrorPublicContest

  // Check if this is a non-public contest being accessed by anonymous user
  const isNonPublicContestForAnonymous =
    !user && !isLoadingUser && !isLoadingContest && !contest && !!id

  // Check if this is an admin-only contest being accessed by non-admin user
  const isAdminOnlyContestForNonAdmin =
    !!user &&
    !isLoadingUser &&
    !isLoadingAdmin &&
    !isLoadingContest &&
    !!contest &&
    contest.visibility === 'admin' &&
    !isAdmin

  // Get receipt count using the actual contest document ID (not the slug!)
  const { data: receiptCount = 0 } = useContestReceiptCount(contest?.$id || '')

  // Categories (embedded in the Supabase detail payload)
  const contestCategories = useMemo(() => {
    const publicCategories = publicContestData?.contest?.categories || []
    return publicCategories.map((c) => ({
      $id: c.$id,
      name_en: c.name_en,
      name_ms: c.name_ms,
      slug: c.slug,
      priority_order: c.priority_order,
      type: c.type,
    })) as unknown as Category[]
  }, [publicContestData?.contest?.categories])

  // Helper function to sort categories by priority and sequence in category_ids array
  const sortCategories = (cats: Category[]) => {
    // Create a map of category ID to original index for sorting
    const categoryIndexMap = new Map<string, number>()
    contest?.category_ids?.forEach((id, index) => {
      categoryIndexMap.set(id, index)
    })

    return [...cats].sort((a, b) => {
      const ao = a.priority_order ?? Number.NEGATIVE_INFINITY
      const bo = b.priority_order ?? Number.NEGATIVE_INFINITY
      if (ao !== bo) return bo - ao
      // Fall back to sequence in category_ids array
      const aIndex = categoryIndexMap.get(a.$id) ?? Number.MAX_SAFE_INTEGER
      const bIndex = categoryIndexMap.get(b.$id) ?? Number.MAX_SAFE_INTEGER
      return aIndex - bIndex
    })
  }

  // Categorize by type
  const prizeCategories = useMemo(
    () =>
      sortCategories(
        contestCategories.filter((c) => c.type === 'prize' || !c.type),
      ),
    [contestCategories],
  )

  const howToEnterCategories = useMemo(
    () =>
      sortCategories(
        contestCategories.filter((c) => c.type === 'how_to_enter'),
      ),
    [contestCategories],
  )

  const businessCategories = useMemo(
    () =>
      sortCategories(
        contestCategories.filter((c) => c.type === 'business_category'),
      ),
    [contestCategories],
  )

  const winnerSelectionCategories = useMemo(
    () =>
      sortCategories(
        contestCategories.filter((c) => c.type === 'winner_selection'),
      ),
    [contestCategories],
  )

  // Files: embedded gallery in the Supabase detail payload; fall back to the
  // main image when there are no gallery files.
  const contestFiles = useMemo(() => {
    const publicContest = publicContestData?.contest as any
    if (Array.isArray(publicContest?.files) && publicContest.files.length > 0) {
      return publicContest.files as ContestFile[]
    }
    if (publicContest?.main_img_id) {
      return [
        {
          $id: 'main-image',
          file_id: publicContest.main_img_id,
          contest_id: publicContest.source_contest_id,
          token_secret: publicContest.main_img_token_secret || '',
          img_blurhash: publicContest.main_img_blurhash || undefined,
          file_order: 0,
        },
      ] as ContestFile[]
    }
    return [] as ContestFile[]
  }, [publicContestData?.contest])

  const isLoadingFiles = isLoadingPublicContest

  // Language preference (backend-agnostic via the prefs abstraction)
  const { data: language = 'en' } = useQuery<'en' | 'ms'>({
    queryKey: ['user-language-preference', 'supabase'],
    queryFn: async () => {
      try {
        const prefs = await getUserPrefs()
        const lang = (prefs as any)?.language || 'en'
        return lang === 'ms' ? 'ms' : 'en'
      } catch {
        return 'en'
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })

  // Helper function to process translations data
  const processTranslations = (
    translations: any[],
    lang: 'en' | 'ms',
  ): {
    prizes?: string
    link_tnc?: string
    link_tnc_locale?: 'en' | 'ms'
    link_faq?: string
    link_faq_locale?: 'en' | 'ms'
    eligible_products_and_purchases?: string
    eligible_participants?: string
    eligible_participants_exclusion?: string
    eligible_stores?: string
    winners_selection_method?: string
    winners_comm_and_timeline?: string
    entry_method_and_submission?: string
    winners_list_and_announcement?: string
  } => {
    const enDoc = translations?.find((r: any) => r.locale === 'en') as any
    const msDoc = translations?.find((r: any) => r.locale === 'ms') as any

    // Use Malay if available and language preference is Malay, otherwise fallback to English
    const selectedDoc = lang === 'ms' && msDoc ? msDoc : enDoc

    // For link_tnc and link_faq: prioritize user's locale, fallback to other locale if not available
    let link_tnc: string | undefined
    let link_tnc_locale: 'en' | 'ms' | undefined
    let link_faq: string | undefined
    let link_faq_locale: 'en' | 'ms' | undefined

    const msTnc = msDoc?.link_tnc?.trim() || undefined
    const enTnc = enDoc?.link_tnc?.trim() || undefined
    const msFaq = msDoc?.link_faq?.trim() || undefined
    const enFaq = enDoc?.link_faq?.trim() || undefined

    if (lang === 'ms') {
      if (msTnc) {
        link_tnc = msTnc
        link_tnc_locale = 'ms'
      } else if (enTnc) {
        link_tnc = enTnc
        link_tnc_locale = 'en'
      }
      if (msFaq) {
        link_faq = msFaq
        link_faq_locale = 'ms'
      } else if (enFaq) {
        link_faq = enFaq
        link_faq_locale = 'en'
      }
    } else {
      if (enTnc) {
        link_tnc = enTnc
        link_tnc_locale = 'en'
      } else if (msTnc) {
        link_tnc = msTnc
        link_tnc_locale = 'ms'
      }
      if (enFaq) {
        link_faq = enFaq
        link_faq_locale = 'en'
      } else if (msFaq) {
        link_faq = msFaq
        link_faq_locale = 'ms'
      }
    }

    return {
      prizes: selectedDoc?.prizes || undefined,
      link_tnc,
      link_tnc_locale,
      link_faq,
      link_faq_locale,
      eligible_products_and_purchases:
        selectedDoc?.eligible_products_and_purchases || undefined,
      eligible_participants: selectedDoc?.eligible_participants || undefined,
      eligible_participants_exclusion:
        selectedDoc?.eligible_participants_exclusion || undefined,
      eligible_stores: selectedDoc?.eligible_stores || undefined,
      winners_selection_method:
        selectedDoc?.winners_selection_method || undefined,
      winners_comm_and_timeline:
        selectedDoc?.winners_comm_and_timeline || undefined,
      entry_method_and_submission:
        selectedDoc?.entry_method_and_submission || undefined,
      winners_list_and_announcement:
        selectedDoc?.winners_list_and_announcement || undefined,
    }
  }

  // Translations (embedded in the Supabase detail payload; premium fields are
  // gated server-side for anonymous callers).
  const contestTranslation = useMemo(() => {
    const sourceContestId = (publicContestData?.contest as any)
      ?.source_contest_id
    const translations = (publicContestData?.translations || []).filter(
      (t: any) => t.source_contest_id === sourceContestId,
    )
    return processTranslations(translations, language)
  }, [publicContestData?.translations, publicContestData?.contest, language])

  // Hosts (embedded in the Supabase detail payload)
  const contestHosts = useMemo(() => {
    const publicHosts = publicContestData?.contest?.hosts || []
    return publicHosts.map((h) => ({
      $id: h.$id,
      name: h.name,
      slug: h.slug,
      img_id: h.img_id,
      img_token_secret: h.img_token_secret,
      img_blurhash: h.img_blurhash,
    })) as unknown as Host[]
  }, [publicContestData?.contest?.hosts])

  const openGallery = (index: number) => {
    setSelectedImageIndex(index)
    setGalleryVisible(true)
  }

  const closeGallery = () => {
    setGalleryVisible(false)
  }

  // Helper function to format prize value
  const formatPrizeValue = (amount: number): string => {
    const rounded = Math.ceil(amount)

    if (rounded >= 1000000) {
      // 1 million or more
      const millions = rounded / 1000000
      if (millions >= 10) {
        return `RM ${Math.round(millions)}mil`
      }
      return `RM ${millions.toFixed(1)}mil`
    } else if (rounded >= 1000) {
      // 1k to 999k
      const thousands = Math.round(rounded / 1000)
      return `RM ${thousands}k`
    } else {
      // Less than 1k
      return `RM ${rounded}`
    }
  }

  // Prepare images for gallery
  const galleryImages: ImageItem[] = contestFiles.map((file, index) => {
    // Supabase stores a full public URL in file_id.
    return {
      id: file.file_id,
      uri: file.file_id,
      tokenSecret: file.token_secret, // Keep for backward compatibility with old images
      blurhash: file.img_blurhash,
      title: contest?.title,
      description: `Image ${index + 1} of ${contestFiles.length}`,
    }
  })

  // Show loading state during auth check, admin check, or contest loading
  if (isLoadingUser || isLoadingAdmin || isLoadingContest || isLoadingFiles) {
    return (
      <>
        <ScrollView
          className="flex-1 dark:bg-black bg-white"
          style={{
            paddingTop: Platform.OS === 'web' ? 66 : 0,
          }}
          contentContainerStyle={{ paddingBottom: bottom + 20 }}
        >
          <View className="px-4 w-full max-w-5xl mx-auto">
            {/* Host Images Skeleton */}
            <View className="flex-row justify-start items-center mb-2 mt-3">
              <View className="w-[70px] h-[70px] mr-2">
                <Skeleton className="w-full h-full rounded-lg" />
              </View>
            </View>

            {/* Title Skeleton */}
            <Skeleton className="h-8 w-3/4 mb-2" />

            {/* Subtitle Skeleton */}
            <Skeleton className="h-4 w-1/2 mb-4" />

            {/* Image Carousel Skeleton */}
            <View className="mb-6">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="w-[280px] mr-4 rounded-lg"
                    style={{ height: imageHeight }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Contest Badges Skeleton */}
            <View className="mb-3">
              <Skeleton className="h-6 w-32 mb-2" />
              <View className="flex-row gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </View>
            </View>

            {/* Contest Information Skeletons */}
            <View className="flex-col gap-4">
              {/* Dates Section */}
              <View className="flex-row justify-between">
                <View className="flex-1 mr-2">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-5 w-28" />
                </View>
                <View className="flex-1">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-5 w-28" />
                </View>
                <View className="flex-1 ml-2">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-5 w-16" />
                </View>
              </View>

              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-5/6 mb-2" />
                  <Skeleton className="h-3 w-4/5 mb-2" />
                  <Skeleton className="h-3 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>

              {/* Prizes Section */}
              <View>
                <Skeleton className="h-6 w-20 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-4/5 mb-2" />
                <Skeleton className="h-4 w-3/5 mb-2" />
                <Skeleton className="h-4 w-2/5" />
              </View>
            </View>
          </View>
        </ScrollView>
      </>
    )
  }

  // Show sign-in prompt for anonymous users trying to access non-public contests
  if (isNonPublicContestForAnonymous) {
    return (
      <View
        className="flex-1 justify-center items-center dark:bg-black bg-white p-6"
        style={{ paddingTop: top, paddingBottom: bottom }}
      >
        <View className="items-center max-w-xs">
          <Text
            className={`text-lg font-semibold text-center mb-4 ${
              isDarkColorScheme ? 'text-white' : 'text-black'
            }`}
          >
            <Trans>Sign in to view this contest</Trans>
          </Text>
          <Text
            className={`text-base text-center mb-6 ${
              isDarkColorScheme ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            <Trans>
              This contest requires you to sign in to view the full details.
            </Trans>
          </Text>
          <Button
            onPress={() =>
              router.push(`/sign-in-register?redirect=/contest/${id}`)
            }
          >
            <Text>
              <Trans>Sign In / Register</Trans>
            </Text>
          </Button>
        </View>
      </View>
    )
  }

  // Show access denied for non-admin users trying to access admin-only contests
  if (isAdminOnlyContestForNonAdmin) {
    return (
      <View
        className="flex-1 justify-center items-center dark:bg-black bg-white p-6"
        style={{ paddingTop: top, paddingBottom: bottom }}
      >
        <View className="items-center max-w-xs">
          <Text
            className={`text-lg font-semibold text-center mb-4 ${
              isDarkColorScheme ? 'text-white' : 'text-black'
            }`}
          >
            <Trans>Admin Only Contest</Trans>
          </Text>
          <Text
            className={`text-base text-center mb-6 ${
              isDarkColorScheme ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            <Trans>This contest is only visible to administrators.</Trans>
          </Text>
          <Button onPress={() => router.push('/')}>
            <Text>
              <Trans>Go to Home</Trans>
            </Text>
          </Button>
        </View>
      </View>
    )
  }

  // Only show "Contest not found" if we're done loading and there's an error or no contest
  if (!isLoadingUser && !isLoadingContest && (isErrorContest || !contest)) {
    return (
      <View
        className="flex-1 justify-center items-center dark:bg-black bg-white"
        style={{ paddingTop: top, paddingBottom: bottom }}
      >
        <Text className="text-red-500 text-center">Contest not found</Text>
      </View>
    )
  }

  // TypeScript guard - should never reach here if contest is undefined
  if (!contest) {
    return null
  }

  const handleActionButtonsLayout = (event: any) => {
    const { y } = event.nativeEvent.layout
    setActionButtonsY(y)
  }

  return (
    <>
      {/* Actions Menu - Fixed Position (Web & Native) - Only show when action buttons are not visible */}
      {showActionsMenu && (
        <ContestActionsMenu
          contestId={contest.$id}
          contestSlug={contest.slug}
          contestTitle={
            language === 'ms' && contest.title_ms
              ? contest.title_ms
              : contest.title
          }
          language={language}
          onManageReceipts={() => setReceiptModalVisible(true)}
          initialUpvoteCount={publicContestData?.contest?.upvote_count}
          showAds={SHOW_ADS}
        />
      )}

      {/* Google AdSense Banner - Fixed below navbar (Web) / Sticky at top (Native) */}
      {/* Only show when SHOW_ADS is true (slot ID is configured and publisher ID is valid) */}
      {SHOW_ADS && (
        <View
          style={
            Platform.OS === 'web'
              ? {
                  position: 'fixed' as any,
                  top: 66, // Height of navbar (60px) + 6px gap to show dotted border clearly
                  left: 0,
                  right: 0,
                  zIndex: 25,
                }
              : {
                  // Native: positioned at top, outside ScrollView
                }
          }
          className="w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800"
        >
          <View className="w-full max-w-5xl mx-auto px-4">
            <AdBanner
              publisherId={ADSENSE_PUBLISHER_ID}
              slotId={ADSENSE_SLOT_ID}
              format="horizontal"
              fullWidthResponsive={true}
              testMode={AD_TEST_MODE}
            />
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 dark:bg-black bg-white"
        style={{
          // Web: Navbar (60px) + gap (6px) + Ad Banner (90px) + border (1px) = 157px
          // Native: No offset needed, ad is above ScrollView
          // Only add padding when ads are shown
          paddingTop:
            Platform.OS === 'web' && SHOW_ADS
              ? 157
              : Platform.OS === 'web'
                ? 66
                : 0,
        }}
        contentContainerStyle={{ paddingBottom: bottom + 20 }}
        onScroll={handleNativeScroll}
        scrollEventThrottle={16}
      >
        {/* Content */}
        <View className="px-4 w-full max-w-5xl mx-auto">
          {/* Host Images Row + Admin Only Badge */}
          <View className="flex-row justify-between items-center mb-2">
            {/* Host Images */}
            <View className="flex-row items-center">
              {contestHosts.map((host) => (
                <View
                  key={host.$id}
                  className="w-[70px] h-[70px] mr-2 overflow-hidden rounded-lg"
                >
                  <HostImage
                    imgId={host.img_id}
                    imgTokenSecret={host.img_token_secret}
                    imgBlurhash={host.img_blurhash}
                    width={70}
                    height={70}
                    borderRadius={8}
                    contentFit="contain"
                  />
                </View>
              ))}
            </View>

            {/* Admin Only Badge */}
            {contest.visibility === 'admin' && (
              <Badge className="bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800">
                <Text className="text-xs font-semibold text-red-700 dark:text-red-300">
                  Admin Only
                </Text>
              </Badge>
            )}
          </View>

          {/* Title */}
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl font-bold text-black dark:text-white">
              {language === 'ms' && (contest as any).title_ms
                ? (contest as any).title_ms
                : contest.title}
            </Text>
          </View>

          {/* By Host Names */}
          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {(() => {
              if (contestHosts.length === 0) return t`By Unknown Host`
              if (contestHosts.length === 1)
                return t`By ${contestHosts[0]?.name || 'Unknown'}`
              if (contestHosts.length === 2)
                return t`By ${contestHosts[0]?.name || 'Unknown'} & ${
                  contestHosts[1]?.name || 'Unknown'
                }`

              // For 3 or more hosts: "By Host1, Host2, Host3 & Host4"
              const allButLast = contestHosts
                .slice(0, -1)
                .map((h) => h?.name || 'Unknown')
                .join(', ')
              const lastHost =
                contestHosts[contestHosts.length - 1]?.name || 'Unknown'
              return t`By ${allButLast} & ${lastHost}`
            })()}
          </Text>

          {/* Image Carousel */}
          {contestFiles.length > 0 && (
            <View className="mb-6">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16, gap: 12 }}
              >
                {contestFiles.map((file, index) => {
                  // Supabase stores a full public URL in file_id.
                  const source: any = {
                    uri: file.file_id,
                  }

                  return (
                    <GalleryThumbnail
                      key={file.file_id}
                      source={source}
                      blurhash={file.img_blurhash}
                      index={index}
                      total={contestFiles.length}
                      onPress={() => openGallery(index)}
                      width={280}
                      height={imageHeight}
                    />
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons Row */}
          <View
            className="mb-4"
            onLayout={handleActionButtonsLayout}
            style={{ marginHorizontal: -12 }}
          >
            <View className="flex-row items-center justify-center md:justify-start">
              <UpvoteButton
                contestId={contest.$id}
                variant="default"
                showCount={true}
                initialCount={publicContestData?.contest?.upvote_count}
              />
              <View style={{ width: 20 }} />
              <SaveButton
                contestId={contest.$id}
                variant="default"
                showText={true}
                receiptCount={receiptCount}
                onManageReceipts={() => setReceiptModalVisible(true)}
                contestTitle={
                  language === 'ms' && contest.title_ms
                    ? contest.title_ms
                    : contest.title
                }
              />
              <View style={{ width: 20 }} />
              <ShareButton
                contestId={contest.slug}
                contestTitle={
                  language === 'ms' && contest.title_ms
                    ? contest.title_ms
                    : contest.title
                }
                language={language}
                variant="default"
              />
            </View>
          </View>

          {/* Contest Badges - End Date and Business Category only */}
          <View className="mb-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{
                alignItems: 'center',
                paddingRight: 4,
                paddingVertical: 2,
              }}
              style={{
                marginHorizontal: -2,
              }}
            >
              {/* End Date Badge */}
              {(() => {
                if (!contest.end_date) return null

                const end = dayjs(contest.end_date)
                if (!end.isValid()) return null

                const now = dayjs()
                const isExpired = end.isBefore(now)
                const hoursUntilEnd = end.diff(now, 'hour')
                const daysUntilEnd = end.diff(now, 'day')

                if (isExpired) {
                  const daysExpired = Math.abs(daysUntilEnd)
                  const hoursExpired = Math.abs(hoursUntilEnd)

                  const timeText =
                    daysExpired >= 1 ? (
                      <Plural
                        value={daysExpired}
                        one="# day ago"
                        other="# days ago"
                      />
                    ) : (
                      <Plural
                        value={hoursExpired}
                        one="# hour ago"
                        other="# hours ago"
                      />
                    )

                  return (
                    <View style={{ marginRight: 8 }}>
                      <Badge
                        variant="outline"
                        className="bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800"
                      >
                        <Text className="text-red-700 dark:text-red-300 font-medium">
                          <Trans>Ended</Trans> {timeText}
                        </Text>
                      </Badge>
                    </View>
                  )
                }

                if (hoursUntilEnd < 72) {
                  const timeText = (
                    <Plural
                      value={hoursUntilEnd}
                      one="in # hour"
                      other="in # hours"
                    />
                  )

                  return (
                    <View style={{ marginRight: 8 }}>
                      <Badge
                        variant="outline"
                        className="bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
                      >
                        <Text className="text-yellow-700 dark:text-yellow-300 font-medium">
                          <Trans>Expiring</Trans> {timeText}
                        </Text>
                      </Badge>
                    </View>
                  )
                }

                if (hoursUntilEnd < 720) {
                  const timeText = (
                    <Plural
                      value={daysUntilEnd}
                      one="in # day"
                      other="in # days"
                    />
                  )

                  return (
                    <View style={{ marginRight: 8 }}>
                      <Badge
                        variant="outline"
                        className="bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
                      >
                        <Text className="text-blue-700 dark:text-blue-300 font-medium">
                          <Trans>Ends</Trans> {timeText}
                        </Text>
                      </Badge>
                    </View>
                  )
                }

                const timeText = (
                  <Plural
                    value={daysUntilEnd}
                    one="in # day"
                    other="in # days"
                  />
                )

                return (
                  <View style={{ marginRight: 8 }}>
                    <Badge
                      variant="outline"
                      className="bg-green-100 border-green-200 dark:bg-green-950 dark:border-green-800"
                    >
                      <Text className="text-green-700 dark:text-green-300 font-medium">
                        <Trans>Ends</Trans> {timeText}
                      </Text>
                    </Badge>
                  </View>
                )
              })()}

              {/* Business Category Badges */}
              {businessCategories.map((category) => (
                <Badge
                  key={category.$id}
                  variant="outline"
                  className="mr-2 bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700"
                >
                  <Text className="text-gray-700 dark:text-neutral-200">
                    {language === 'ms' && category.name_ms
                      ? category.name_ms
                      : category.name_en}
                  </Text>
                </Badge>
              ))}
            </ScrollView>
          </View>

          {/* Contest Information */}
          <View className="flex-col gap-4">
            <View className="flex-row justify-between">
              <View className="flex-1 mr-2">
                <Trans>
                  <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Start Date
                  </Text>
                </Trans>
                <Text className="text-black dark:text-white text-sm">
                  {new Date(contest.start_date).toLocaleDateString('ms-MY', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View className="flex-1">
                <Trans>
                  <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    End Date
                  </Text>
                </Trans>
                <Text className="text-black dark:text-white text-sm">
                  {new Date(contest.end_date).toLocaleDateString('ms-MY', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View className="flex-1 ml-2">
                <Trans>
                  <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Contest Period
                  </Text>
                </Trans>
                <Text className="text-black dark:text-white text-sm">
                  {(() => {
                    const startDate = new Date(contest.start_date)
                    const endDate = new Date(contest.end_date)
                    const diffTime = Math.abs(
                      endDate.getTime() - startDate.getTime(),
                    )
                    const diffDays =
                      Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                    return t`${diffDays} days`
                  })()}
                </Text>
              </View>
            </View>

            {/* Eligibility & Where to buy Card */}
            <Card>
              <CardHeader>
                <Trans>
                  <CardTitle className="text-lg">
                    Eligibility & Where to buy
                  </CardTitle>
                </Trans>
              </CardHeader>
              <CardContent className="flex-col gap-4">
                {/* Eligible Participants */}
                {contestTranslation?.eligible_participants && (
                  <View>
                    <View className="flex-row items-center mb-2">
                      <Trans>
                        <Text className="text-base font-semibold text-black dark:text-white">
                          👥 Eligible Participants
                        </Text>
                      </Trans>
                      {contestTranslation?.eligible_participants_exclusion && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Pressable className="ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              <Text className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                <Trans>Exclusions</Trans>
                              </Text>
                            </Pressable>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <View>
                              <Trans>
                                <Text className="text-sm font-semibold text-black dark:text-white mb-2">
                                  Exclusions:
                                </Text>
                              </Trans>
                              <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {
                                  contestTranslation.eligible_participants_exclusion
                                }
                              </MarkdownText>
                            </View>
                          </PopoverContent>
                        </Popover>
                      )}
                    </View>
                    <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {contestTranslation.eligible_participants}
                    </MarkdownText>
                  </View>
                )}

                {/* Eligible Products and Purchases */}
                {contestTranslation?.eligible_products_and_purchases && (
                  <View>
                    <Trans>
                      <Text className="text-base font-semibold text-black dark:text-white mb-2">
                        💳 Eligible Purchases & Products 🛍️
                      </Text>
                    </Trans>
                    <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {contestTranslation.eligible_products_and_purchases}
                    </MarkdownText>
                  </View>
                )}

                {/* Eligible Stores */}
                {contestTranslation?.eligible_stores && (
                  <View>
                    <Trans>
                      <Text className="text-base font-semibold text-black dark:text-white mb-2">
                        🛒 Eligible Stores
                      </Text>
                    </Trans>
                    <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {contestTranslation.eligible_stores}
                    </MarkdownText>
                  </View>
                )}

                {/* Eligible Online Stores */}
                {(contest?.link_aff_shopee ||
                  contest?.link_aff_lazada ||
                  contest?.link_aff_tiktok_shop) && (
                  <View>
                    <View className="flex-row items-center mb-2">
                      <Trans>
                        <Text className="text-base font-semibold text-black dark:text-white">
                          Eligible Stores
                          <Text className="text-base"> (JomPoints)</Text>
                        </Text>
                      </Trans>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Pressable
                            className="ml-2 px-2 py-1 rounded"
                            style={
                              Platform.OS === 'web'
                                ? undefined
                                : { backgroundColor: main + '1A' } // 1A is 10% opacity in hex
                            }
                          >
                            <Trans>
                              <Text
                                className="text-xs font-medium"
                                style={
                                  Platform.OS === 'web'
                                    ? undefined
                                    : { color: main }
                                }
                              >
                                what is this?
                              </Text>
                            </Trans>
                          </Pressable>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <View>
                            <Trans>
                              <Text className="text-sm font-semibold text-black dark:text-white mb-2">
                                Eligible Stores (with potential to earn
                                JomPoints)
                              </Text>
                            </Trans>
                            <Trans>
                              <Text className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                Shop link(s) provided below are affiliate
                                link(s), depending on the terms and conditions,
                                a purchase coming from the link(s) may or may
                                not be rewarded. If it is rewarded, we will
                                credit a proportion of the reward to you as
                                JomPoints. This feature is still in Beta, and we
                                are not liable for any discrepancies or
                                inaccuracies that may occur.
                              </Text>
                            </Trans>
                          </View>
                        </PopoverContent>
                      </Popover>
                    </View>
                    <View className="flex-row flex-wrap gap-3">
                      {contest?.link_aff_shopee && (
                        <Link href={contest.link_aff_shopee}>
                          <View className="bg-orange-500 px-4 py-2 rounded-lg">
                            <Text className="text-white font-medium">
                              Shopee
                            </Text>
                          </View>
                        </Link>
                      )}
                      {contest?.link_aff_lazada && (
                        <Link href={contest.link_aff_lazada}>
                          <View className="bg-[#D4145A] px-4 py-2 rounded-lg">
                            <Text className="text-white font-medium">
                              Lazada
                            </Text>
                          </View>
                        </Link>
                      )}
                      {contest?.link_aff_tiktok_shop && (
                        <Link href={contest.link_aff_tiktok_shop}>
                          <View className="bg-black dark:bg-white px-4 py-2 rounded-lg">
                            <Text className="text-white dark:text-black font-medium">
                              TikTok Shop
                            </Text>
                          </View>
                        </Link>
                      )}
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>

            {/* Prizes with Total Prize Value Badge */}
            <View>
              <View className="flex-row items-center mb-2">
                <Trans>
                  <Text className="text-lg font-semibold text-black dark:text-white">
                    Prizes
                  </Text>
                </Trans>
                {((contest.total_prizes_value_rm ?? 0) > 0 ||
                  prizeCategories.length > 0) && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="ml-2"
                    contentContainerStyle={{ alignItems: 'center' }}
                  >
                    {(contest.total_prizes_value_rm ?? 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="mr-2 bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
                      >
                        <Text className="text-yellow-700 dark:text-yellow-300 font-medium">
                          <Trans>Worth:</Trans>{' '}
                          {formatPrizeValue(contest.total_prizes_value_rm!)}
                        </Text>
                      </Badge>
                    )}
                    {prizeCategories.map((category) => (
                      <Badge
                        key={category.$id}
                        variant="outline"
                        className="mr-2 bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700"
                      >
                        <Text className="text-gray-700 dark:text-neutral-200">
                          {language === 'ms' && category.name_ms
                            ? category.name_ms
                            : category.name_en}
                        </Text>
                      </Badge>
                    ))}
                  </ScrollView>
                )}
              </View>
              {contestTranslation?.prizes && (
                <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contestTranslation.prizes}
                </MarkdownText>
              )}
            </View>

            {/* Entry Method and Submission */}
            {contestTranslation?.entry_method_and_submission && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <Trans>
                      <Text className="text-lg font-semibold text-black dark:text-white">
                        How to Enter
                      </Text>
                    </Trans>
                    {howToEnterCategories.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="ml-2"
                        contentContainerStyle={{ alignItems: 'center' }}
                      >
                        {howToEnterCategories.map((category) => (
                          <Badge
                            key={category.$id}
                            variant="outline"
                            className="mr-2 bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700"
                          >
                            <Text className="text-gray-700 dark:text-neutral-200">
                              {language === 'ms' && category.name_ms
                                ? category.name_ms
                                : category.name_en}
                            </Text>
                          </Badge>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.entry_method_and_submission}
                  </MarkdownText>
                </View>
              </>
            )}

            {/* Winners Selection Method - Locked for anonymous users */}
            {!user && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500 mr-2">
                      🔒
                    </Text>
                    <Trans>
                      <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                        Winners Selection Method
                      </Text>
                    </Trans>
                  </View>
                  <Link href="/sign-in-register">
                    <View className="py-4 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        <Trans>
                          Sign in or register to view winner selection details
                        </Trans>
                      </Text>
                    </View>
                  </Link>
                </View>
              </>
            )}
            {user && contestTranslation?.winners_selection_method && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <View style={{ flexShrink: 0 }}>
                      <Trans>
                        <Text className="text-lg font-semibold text-black dark:text-white">
                          Winners Selection Method
                        </Text>
                      </Trans>
                    </View>
                    {winnerSelectionCategories.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="ml-2"
                        style={{ flexShrink: 1 }}
                        contentContainerStyle={{ alignItems: 'center' }}
                      >
                        {winnerSelectionCategories.map((category) => (
                          <Badge
                            key={category.$id}
                            variant="outline"
                            className="mr-2 bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700"
                          >
                            <Text className="text-gray-700 dark:text-neutral-200">
                              {language === 'ms' && category.name_ms
                                ? category.name_ms
                                : category.name_en}
                            </Text>
                          </Badge>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.winners_selection_method}
                  </MarkdownText>
                </View>
              </>
            )}

            {/* Winners Communication Channel & Timeline - Locked for anonymous users */}
            {!user && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500 mr-2">
                      🔒
                    </Text>
                    <Trans>
                      <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                        Winners Communication Channel & Timeline
                      </Text>
                    </Trans>
                  </View>
                  <Link href="/sign-in-register">
                    <View className="py-4 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        <Trans>
                          Sign in or register to view winners communication
                          details
                        </Trans>
                      </Text>
                    </View>
                  </Link>
                </View>
              </>
            )}
            {user && contestTranslation?.winners_comm_and_timeline && (
              <>
                <Separator />
                <View>
                  <Trans>
                    <Text className="text-lg font-semibold text-black dark:text-white mb-2">
                      Winners Communication Channel & Timeline
                    </Text>
                  </Trans>
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.winners_comm_and_timeline}
                  </MarkdownText>
                </View>
              </>
            )}

            {/* Winners List & Announcement - Locked for anonymous users */}
            {!user && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500 mr-2">
                      🔒
                    </Text>
                    <Trans>
                      <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                        Winners List & Announcement
                      </Text>
                    </Trans>
                  </View>
                  <Link href="/sign-in-register">
                    <View className="py-4 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        <Trans>
                          Sign in or register to view winners announcement
                          details
                        </Trans>
                      </Text>
                    </View>
                  </Link>
                </View>
              </>
            )}
            {user && contestTranslation?.winners_list_and_announcement && (
              <>
                <Separator />
                <View>
                  <Trans>
                    <Text className="text-lg font-semibold text-black dark:text-white mb-2">
                      Winners List & Announcement
                    </Text>
                  </Trans>
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.winners_list_and_announcement}
                  </MarkdownText>
                </View>
              </>
            )}

            {/* Additional Information Section - Locked for anonymous users */}
            {!user && (
              <>
                <Separator />
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500 mr-2">
                      🔒
                    </Text>
                    <Trans>
                      <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                        Additional Information
                      </Text>
                    </Trans>
                  </View>
                  <Link href="/sign-in-register">
                    <View className="py-4 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                      <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        <Trans>
                          Sign in or register to view additional important
                          information
                        </Trans>
                      </Text>
                    </View>
                  </Link>
                </View>
              </>
            )}

            {/* Additional Information Section - Only for logged-in users */}
            {user &&
              (contestTranslation?.link_tnc ||
                contestTranslation?.link_faq ||
                contest?.link_media_instagram ||
                contest?.link_media_facebook ||
                contest?.link_media_tiktok ||
                contest?.link_media_x ||
                contest?.link_media_youtube ||
                contest?.link_media_website) && (
                <>
                  <Separator />
                  <View>
                    <Trans>
                      <Text className="text-lg font-semibold text-black dark:text-white mb-2">
                        Additional Information
                      </Text>
                    </Trans>

                    {/* Terms & Conditions and FAQ */}
                    {(contestTranslation?.link_tnc ||
                      contestTranslation?.link_faq) && (
                      <View className="flex-row flex-wrap gap-4 mb-4">
                        {contestTranslation?.link_tnc && (
                          <View className="flex-row flex-wrap items-baseline">
                            <Link
                              href={contestTranslation.link_tnc}
                              target="_blank"
                            >
                              <Text
                                className={
                                  Platform.OS === 'web'
                                    ? 'text-main underline'
                                    : 'underline'
                                }
                                style={
                                  Platform.OS === 'web'
                                    ? undefined
                                    : { color: main }
                                }
                              >
                                {language === 'ms'
                                  ? 'Terma & Syarat'
                                  : 'Terms & Conditions'}
                              </Text>
                            </Link>
                            {(() => {
                              const tncLocale =
                                contestTranslation.link_tnc_locale
                              const isFallback = tncLocale !== language

                              if (!isFallback) return null

                              // Show fallback note in normal text color
                              if (language === 'ms' && tncLocale === 'en') {
                                return (
                                  <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                                    (dalam Bahasa Inggeris sahaja)
                                  </Text>
                                )
                              } else if (
                                language === 'en' &&
                                tncLocale === 'ms'
                              ) {
                                return (
                                  <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                                    (in Bahasa Malaysia only)
                                  </Text>
                                )
                              }
                              return null
                            })()}
                          </View>
                        )}
                        {contestTranslation?.link_faq && (
                          <View className="flex-row flex-wrap items-baseline">
                            <Link
                              href={contestTranslation.link_faq}
                              target="_blank"
                            >
                              <Text
                                className={
                                  Platform.OS === 'web'
                                    ? 'text-main underline'
                                    : 'underline'
                                }
                                style={
                                  Platform.OS === 'web'
                                    ? undefined
                                    : { color: main }
                                }
                              >
                                {language === 'ms' ? 'Soalan Lazim' : 'FAQ'}
                              </Text>
                            </Link>
                            {(() => {
                              const faqLocale =
                                contestTranslation.link_faq_locale
                              const isFallback = faqLocale !== language

                              if (!isFallback) return null

                              // Show fallback note in normal text color
                              if (language === 'ms' && faqLocale === 'en') {
                                return (
                                  <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                                    (dalam Bahasa Inggeris sahaja)
                                  </Text>
                                )
                              } else if (
                                language === 'en' &&
                                faqLocale === 'ms'
                              ) {
                                return (
                                  <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                                    (in Bahasa Malaysia only)
                                  </Text>
                                )
                              }
                              return null
                            })()}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Social Media Links */}
                    {(contest?.link_media_instagram ||
                      contest?.link_media_facebook ||
                      contest?.link_media_tiktok ||
                      contest?.link_media_x ||
                      contest?.link_media_youtube ||
                      contest?.link_media_linkedin ||
                      contest?.link_media_website) && (
                      <Card className="bg-main/5 border-main/20">
                        <CardContent className="pt-6">
                          {/* Section Title */}
                          <Text className="text-sm font-semibold text-black dark:text-white mb-4">
                            {contest?.link_media_website ? (
                              contest?.link_media_instagram ||
                              contest?.link_media_facebook ||
                              contest?.link_media_tiktok ||
                              contest?.link_media_x ||
                              contest?.link_media_youtube ||
                              contest?.link_media_linkedin ? (
                                <Trans>
                                  Contest posting on organiser's social media &
                                  website:
                                </Trans>
                              ) : (
                                <Trans>
                                  Contest posting on organiser's website:
                                </Trans>
                              )
                            ) : (
                              <Trans>
                                Contest posting on organiser's social media:
                              </Trans>
                            )}
                          </Text>

                          {/* Social Media Icons Row */}
                          <View className="flex-row items-center gap-4 flex-wrap">
                            {contest?.link_media_instagram && (
                              <Link
                                href={contest.link_media_instagram}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <InstagramSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_facebook && (
                              <Link
                                href={contest.link_media_facebook}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <FacebookSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_tiktok && (
                              <Link
                                href={contest.link_media_tiktok}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <TikTokSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_x && (
                              <Link href={contest.link_media_x} target="_blank">
                                <View className="p-2">
                                  <XSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_youtube && (
                              <Link
                                href={contest.link_media_youtube}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <YouTubeSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_linkedin && (
                              <Link
                                href={contest.link_media_linkedin}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <LinkedInSolid
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                            {contest?.link_media_website && (
                              <Link
                                href={contest.link_media_website}
                                target="_blank"
                              >
                                <View className="p-2">
                                  <GlobeAltOutline
                                    width={28}
                                    height={28}
                                    color={
                                      isDarkColorScheme ? '#e5e5e5' : '#1f2937'
                                    }
                                  />
                                </View>
                              </Link>
                            )}
                          </View>
                        </CardContent>
                      </Card>
                    )}
                  </View>
                </>
              )}
          </View>
        </View>
      </ScrollView>

      {/* Image Gallery Modal */}
      <ImageGallery
        images={galleryImages}
        initialIndex={selectedImageIndex}
        isVisible={galleryVisible}
        onClose={closeGallery}
      />

      {/* Receipt Manager Modal */}
      {contest && (
        <ReceiptManagerModal
          visible={receiptModalVisible}
          contestId={contest.$id}
          contestTitle={
            language === 'ms' && contest.title_ms
              ? contest.title_ms
              : contest.title
          }
          onClose={() => setReceiptModalVisible(false)}
        />
      )}
    </>
  )
}
