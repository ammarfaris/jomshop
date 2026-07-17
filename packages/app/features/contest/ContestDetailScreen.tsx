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
import { toast } from 'app/lib/sonner-universal'
import { I18nProvider } from '@lingui/react'
import { getLocaleScopedI18n } from 'app/lib/lingui/locale-scoped-i18n'
import {
  AdminEditableField,
  AdminEditableDateRange,
  useAdminInlineContestSave,
} from 'app/features/contest/components/AdminEditableField'
import {
  AdminVisibilitySelect,
  AdminCategoriesEditor,
  AdminHostsEditor,
  AdminImagesEditor,
} from 'app/features/contest/components/AdminContestMetaEditors'
import type {
  ContestInlinePatch,
  TranslationInlineField,
} from 'app/lib/supabase/admin'
import { slugify } from 'app/lib/supabase/adminTransforms'
import {
  CONTEST_CHAR_LIMITS,
  TRANSLATION_CHAR_LIMITS,
} from 'app/features/admin/contestFieldLimits'

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

// Admin language/edit modes for the detail page toggle. The two Both modes
// need the wide side-by-side layout; only 'both-edit' enables inline editing.
type AdminLangMode = 'en' | 'ms' | 'both' | 'both-edit'
const ADMIN_LANG_MODES: AdminLangMode[] = ['en', 'ms', 'both', 'both-edit']

// Resolved translation view for a single locale. `processContestTranslations`
// picks the doc for `lang` and resolves T&C / FAQ links with locale fallback.
type ContestTranslationView = {
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
}

function processContestTranslations(
  translations: any[],
  lang: 'en' | 'ms',
): ContestTranslationView {
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

function getLocaleOwnedContestTranslation(
  translations: any[],
  lang: 'en' | 'ms',
): ContestTranslationView {
  const localeDoc = translations?.find((r: any) => r.locale === lang) as any

  return {
    prizes: localeDoc?.prizes || undefined,
    link_tnc: localeDoc?.link_tnc || undefined,
    link_tnc_locale: localeDoc?.link_tnc ? lang : undefined,
    link_faq: localeDoc?.link_faq || undefined,
    link_faq_locale: localeDoc?.link_faq ? lang : undefined,
    eligible_products_and_purchases:
      localeDoc?.eligible_products_and_purchases || undefined,
    eligible_participants: localeDoc?.eligible_participants || undefined,
    eligible_participants_exclusion:
      localeDoc?.eligible_participants_exclusion || undefined,
    eligible_stores: localeDoc?.eligible_stores || undefined,
    winners_selection_method: localeDoc?.winners_selection_method || undefined,
    winners_comm_and_timeline: localeDoc?.winners_comm_and_timeline || undefined,
    entry_method_and_submission:
      localeDoc?.entry_method_and_submission || undefined,
    winners_list_and_announcement:
      localeDoc?.winners_list_and_announcement || undefined,
  }
}

// Accept contestId as a prop, or fallback to route param
export default function ContestDetailScreen({
  contestId,
}: {
  contestId?: string
}) {
  // Use the provided contestId prop if available, otherwise fallback to route param
  const params = useContestDetailParams()
  const id = contestId ?? params?.id ?? ''
  const { top, bottom } = useSafeArea()
  const { user, isLoading: isLoadingUser } = useAuth()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin()
  const { isDarkColorScheme } = useColorScheme()

  const { main } = useColorThemeValues(isDarkColorScheme)
  const router = useRouter()

  const [receiptModalVisible, setReceiptModalVisible] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [actionButtonsY, setActionButtonsY] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)

  // Calculate image height for consistent sizing
  const { width: screenWidth } = Dimensions.get('window')
  const imageHeight = Math.min(screenWidth * 0.75, 400)

  // Side-by-side "Both" view only renders on wide screens (desktop). The detail
  // layout maxes out at max-w-5xl (~1024px); below this there's no room for two
  // readable columns. Re-read on resize so toggling after rotating/width change
  // reflects current viewport.
  const [canShowBoth, setCanShowBoth] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth >= 1024
      : screenWidth >= 1024,
  )
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onResize = () =>
      setCanShowBoth((window.innerWidth || 0) >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
  } = usePublicContestBySlug(
    id || '',
    !isLoadingUser && !isLoadingAdmin && !!id,
  )

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

  // Admin-only language override on the contest detail page: admins can flip
  // between EN / BM / View Both / Edit Both. Both modes render two side-by-side
  // content trees; only Edit Both turns on the inline pencil editors — every
  // other mode is view-only. The toggle itself is admin-gated (see header).
  // Non-admins always read from their persisted language preference.
  const [adminLangMode, setAdminLangMode] = useState<AdminLangMode | null>(
    () => {
      if (typeof window === 'undefined') return null
      const stored = window.localStorage.getItem('admin-contest-lang-mode')
      return ADMIN_LANG_MODES.includes(stored as AdminLangMode)
        ? (stored as AdminLangMode)
        : null
    },
  )
  useEffect(() => {
    if (!isAdmin || !adminLangMode) return
    try {
      window.localStorage.setItem('admin-contest-lang-mode', adminLangMode)
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [adminLangMode, isAdmin])

  // Default to Edit Both when the screen fits two columns, otherwise the
  // admin's saved locale. A saved Both mode is likewise demoted to the saved
  // locale on narrow screens (both modes need the side-by-side layout).
  const resolvedAdminMode: AdminLangMode = (() => {
    const mode = adminLangMode ?? (canShowBoth ? 'both-edit' : language)
    if ((mode === 'both' || mode === 'both-edit') && !canShowBoth) {
      return language
    }
    return mode
  })()

  const effectiveLanguage: 'en' | 'ms' =
    isAdmin && (resolvedAdminMode === 'en' || resolvedAdminMode === 'ms')
      ? resolvedAdminMode
      : language
  const isBothMode =
    isAdmin &&
    (resolvedAdminMode === 'both' || resolvedAdminMode === 'both-edit')
  const canEditInline = isAdmin && resolvedAdminMode === 'both-edit'

  const contestTranslations = useMemo(() => {
    const sourceContestId = (publicContestData?.contest as any)
      ?.source_contest_id
    return (publicContestData?.translations || []).filter(
      (t: any) => t.source_contest_id === sourceContestId,
    )
  }, [publicContestData?.translations, publicContestData?.contest])

  // Translations (embedded in the Supabase detail payload; premium fields are
  // gated server-side for anonymous callers). Compute one view for the
  // effective language, plus separate EN / MS views when "Both" is active so
  // each side-by-side column renders its own locale without fallback mixing.
  const contestTranslation = useMemo(() => {
    return processContestTranslations(contestTranslations, effectiveLanguage)
  }, [contestTranslations, effectiveLanguage])
  const contestTranslationOwn = useMemo(() => {
    return getLocaleOwnedContestTranslation(contestTranslations, effectiveLanguage)
  }, [contestTranslations, effectiveLanguage])

  const contestTranslationEn = useMemo(() => {
    return processContestTranslations(contestTranslations, 'en')
  }, [contestTranslations])
  const contestTranslationEnOwn = useMemo(() => {
    return getLocaleOwnedContestTranslation(contestTranslations, 'en')
  }, [contestTranslations])

  const contestTranslationMs = useMemo(() => {
    return processContestTranslations(contestTranslations, 'ms')
  }, [contestTranslations])
  const contestTranslationMsOwn = useMemo(() => {
    return getLocaleOwnedContestTranslation(contestTranslations, 'ms')
  }, [contestTranslations])

  // Admin-only inline editing (pencil icons per item). Saves patch a single
  // field and invalidate this page's detail query.
  const {
    saveContestFields,
    saveTranslationField,
    saveContestHosts,
    saveContestCategories,
    saveContestImages,
  } = useAdminInlineContestSave(id)

  // Required-field gaps that block a visibility change beyond 'admin' from
  // the inline dropdown. Mirrors the create form's full submit validation:
  // createContestSchema's EN requirements plus the checks that live outside
  // the schema there (≥1 image, ≥1 host, ≥1 category).
  const missingRequiredFields = useMemo(() => {
    if (!contest) return []
    const missing = new Set<string>()
    const add = (msg: string) => missing.add(msg)
    const pushIfOverLimit = (
      value: string | null | undefined,
      limit: number,
      label: string,
    ) => {
      if (value && value.length > limit) {
        add(`${label} exceeds ${limit} chars`)
      }
    }
    if (!contest.title?.trim()) add('Title (EN)')
    if (!contest.summary?.trim()) add('Summary (EN)')
    if (!contest.slug?.trim()) add('Slug')
    if (!contest.start_date) add('Start date')
    if (!contest.end_date) add('End date')
    if (contest.start_date && contest.end_date) {
      const start = new Date(contest.start_date)
      const end = new Date(contest.end_date)
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end.getTime() <= start.getTime()
      ) {
        add('End date must be after start date')
      }
    }
    const contestLengthChecks: Array<[keyof typeof CONTEST_CHAR_LIMITS, string]> = [
      ['title', 'Title (EN)'],
      ['title_ms', 'Title (BM)'],
      ['summary', 'Summary (EN)'],
      ['summary_ms', 'Summary (BM)'],
      ['slug', 'Slug'],
      ['link_aff_shopee', 'Shopee affiliate link'],
      ['link_aff_lazada', 'Lazada affiliate link'],
      ['link_aff_tiktok_shop', 'TikTok Shop affiliate link'],
      ['link_media_instagram', 'Instagram link'],
      ['link_media_facebook', 'Facebook link'],
      ['link_media_tiktok', 'TikTok link'],
      ['link_media_x', 'X link'],
      ['link_media_youtube', 'YouTube link'],
      ['link_media_linkedin', 'LinkedIn link'],
      ['link_media_website', 'Website link'],
    ]
    for (const [field, label] of contestLengthChecks) {
      pushIfOverLimit(
        contest[field as keyof Contest] as string | null | undefined,
        CONTEST_CHAR_LIMITS[field],
        label,
      )
    }

    if (contestFiles.length === 0) add('At least one contest image')
    if (contestHosts.length === 0) add('At least one host')
    if (contestCategories.length === 0) add('At least one category')
    const en = contestTranslationEnOwn
    const ms = contestTranslationMsOwn
    const requiredEn: Array<[string | undefined, string, number]> = [
      [en.prizes, 'Prizes (EN)', TRANSLATION_CHAR_LIMITS.prizes],
      [
        en.eligible_products_and_purchases,
        'Eligible Purchases & Products (EN)',
        TRANSLATION_CHAR_LIMITS.eligible_products,
      ],
      [
        en.eligible_participants,
        'Eligible Participants (EN)',
        TRANSLATION_CHAR_LIMITS.eligible_participants,
      ],
      [en.eligible_stores, 'Eligible Stores (EN)', TRANSLATION_CHAR_LIMITS.eligible_stores],
      [
        en.winners_selection_method,
        'Winners Selection Method (EN)',
        TRANSLATION_CHAR_LIMITS.winners_selection_method,
      ],
      [
        en.entry_method_and_submission,
        'Entry Method & Submission (EN)',
        TRANSLATION_CHAR_LIMITS.entry_method,
      ],
      [
        en.winners_comm_and_timeline,
        'Winners Communication Channel & Timeline (EN)',
        TRANSLATION_CHAR_LIMITS.winners_comm_and_timeline,
      ],
      [
        en.winners_list_and_announcement,
        'Winners List & Announcement (EN)',
        TRANSLATION_CHAR_LIMITS.winners_list_and_announcement,
      ],
    ]
    for (const [value, label, limit] of requiredEn) {
      if (!value?.trim()) add(label)
      pushIfOverLimit(value, limit, label)
    }

    const translationLengthChecks: Array<
      [keyof ContestTranslationView, keyof typeof TRANSLATION_CHAR_LIMITS, string]
    > = [
      ['prizes', 'prizes', 'Prizes'],
      ['eligible_products_and_purchases', 'eligible_products', 'Eligible Purchases & Products'],
      ['eligible_participants', 'eligible_participants', 'Eligible Participants'],
      ['eligible_participants_exclusion', 'eligible_participants_exclusion', 'Participant exclusions'],
      ['eligible_stores', 'eligible_stores', 'Eligible Stores'],
      ['entry_method_and_submission', 'entry_method', 'Entry Method & Submission'],
      ['winners_selection_method', 'winners_selection_method', 'Winners Selection Method'],
      ['winners_comm_and_timeline', 'winners_comm_and_timeline', 'Winners Communication Channel & Timeline'],
      ['winners_list_and_announcement', 'winners_list_and_announcement', 'Winners List & Announcement'],
      ['link_tnc', 'link_tnc', 'T&C link'],
      ['link_faq', 'link_faq', 'FAQ link'],
    ]
    const checkTranslationLimits = (
      translation: ContestTranslationView,
      localeLabel: 'EN' | 'BM',
    ) => {
      for (const [field, limitKey, label] of translationLengthChecks) {
        pushIfOverLimit(
          translation[field] as string | undefined,
          TRANSLATION_CHAR_LIMITS[limitKey],
          `${label} (${localeLabel})`,
        )
      }
    }
    checkTranslationLimits(en, 'EN')
    checkTranslationLimits(ms, 'BM')

    return Array.from(missing)
  }, [
    contest,
    contestFiles,
    contestHosts,
    contestCategories,
    contestTranslationEnOwn,
    contestTranslationMsOwn,
  ])

  // Same auto-slug recipe as the admin portal's Generate button:
  // {host slugs}-{title}-from-{start}-until-{end} (local dates).
  const generateContestSlug = () => {
    if (!contest) return ''
    const localDate = (dateStr?: string) => {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${month}-${day}`
    }
    const hostPart = contestHosts
      .map((h) => h.slug || slugify(h.name))
      .filter(Boolean)
      .join('-')
    const mainPart = [hostPart, slugify(contest.title)]
      .filter((p) => !!p && p.trim())
      .join('-')
    const generated = `${mainPart}-from-${localDate(contest.start_date)}-until-${localDate(
      contest.end_date,
    )}`
    return generated
      .slice(0, CONTEST_CHAR_LIMITS.slug)
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }

  // Saving a new slug moves the page's URL, so after a successful save we
  // navigate to the new address (the detail query is keyed by slug).
  const saveSlug = async (value: string) => {
    if (!contest) return
    const next = value.trim().toLowerCase()
    if (!next) throw new Error('Slug cannot be empty')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
      throw new Error(
        'Slug can only contain lowercase letters, numbers and hyphens',
      )
    }
    if (next.length > CONTEST_CHAR_LIMITS.slug) {
      throw new Error(
        `Slug must be ${CONTEST_CHAR_LIMITS.slug} characters or less`,
      )
    }
    if (next === contest.slug) return
    await saveContestFields(contest.$id, { slug: next })
    router.replace(`/contest/${next}`)
  }

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
  if (
    !isLoadingUser &&
    !isLoadingAdmin &&
    !isLoadingContest &&
    (isErrorContest || !contest)
  ) {
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
      {showActionsMenu && !isBothMode && (
        <ContestActionsMenu
          contestId={contest.$id}
          contestSlug={contest.slug}
          contestTitle={
            effectiveLanguage === 'ms' && contest.title_ms
              ? contest.title_ms
              : contest.title
          }
          language={effectiveLanguage}
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
          {/* Header. For admins the control bar (Admin Only pill + visibility
              dropdown + EN/BM/View Both/Edit Both toggle) sits on its own row
              so the Edit Both strip (slug, categories, images) can slot in
              between the bar and the host images. Non-admins keep the single
              host-images row. */}
          {isAdmin ? (
            <>
              {/* Admin bar. Left: visibility control (Edit Both only).
                  Right: Admin Only pill next to the EN/BM/View Both/Edit Both
                  toggle. */}
              <View className="flex-row justify-between items-center mb-2 mt-2 gap-2 flex-wrap">
                <View className="flex-row items-center gap-2">
                  {/* Visibility dropdown (Edit Both only). Changing it asks
                      for confirmation; making the contest visible beyond
                      admins is blocked while required fields are missing. */}
                  {canEditInline && (
                    <>
                      <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Visibility
                      </Text>
                      <AdminVisibilitySelect
                        value={contest.visibility ?? 'users'}
                        missingRequiredFields={missingRequiredFields}
                        onSave={(next) =>
                          saveContestFields(contest.$id, { visibility: next })
                        }
                      />
                    </>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  {contest.visibility === 'admin' && (
                    <Badge className="bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800">
                      <Text className="text-xs font-semibold text-red-700 dark:text-red-300">
                        Admin Only
                      </Text>
                    </Badge>
                  )}
                  <AdminLanguageToggle
                    value={resolvedAdminMode}
                    onChange={(mode) => {
                      if (
                        (mode === 'both' || mode === 'both-edit') &&
                        !canShowBoth
                      ) {
                        toast.error(
                          'Side-by-side view needs a wider screen (desktop).',
                        )
                        return
                      }
                      setAdminLangMode(mode)
                    }}
                  />
                </View>
              </View>

              {/* Edit Both strip: slug, categories, and the image gallery —
                  contest-level fields that don't belong to either column. */}
              {canEditInline && (
                <View className="mb-3 gap-2 rounded-md border border-dashed border-main/40 p-2">
                  <AdminEditableField
                    enabled
                    label="Slug"
                    value={contest.slug}
                    multiline={false}
                    maxLength={CONTEST_CHAR_LIMITS.slug}
                    shared
                    hint="Lowercase letters, numbers and hyphens. On save the page follows the new URL, but previously shared links to the old slug will stop working."
                    generateValue={generateContestSlug}
                    generateLabel="Auto-generate"
                    confirmSave={{
                      title: 'Change the contest URL?',
                      message:
                        'The contest page moves to the new slug immediately ' +
                        '(you will be taken there). Any previously shared ' +
                        'links, social posts, QR codes, and search results ' +
                        'pointing to the old slug will stop working.',
                    }}
                    onSave={saveSlug}
                  >
                    <Text className="text-xs text-gray-600 dark:text-gray-400">
                      Slug: {contest.slug}
                    </Text>
                  </AdminEditableField>
                  <AdminCategoriesEditor
                    categories={contestCategories}
                    requireNonEmpty={contest.visibility !== 'admin'}
                    onSave={(ids) => saveContestCategories(contest.$id, ids)}
                  />
                  <AdminImagesEditor
                    contestId={contest.$id}
                    slugBase={contest.slug}
                    imageCount={contestFiles.length}
                    onSave={saveContestImages}
                  />
                </View>
              )}

              {/* Host images (+ hosts pencil in Edit Both) */}
              <View className="flex-row items-center mb-4">
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
                {canEditInline && (
                  <AdminHostsEditor
                    hosts={contestHosts}
                    requireNonEmpty={contest.visibility !== 'admin'}
                    onSave={(ids) => saveContestHosts(contest.$id, ids)}
                  />
                )}
              </View>
            </>
          ) : (
            <View className="flex-row justify-between items-center mb-4 mt-2">
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
            </View>
          )}

          {/* Per-locale column(s): one column for EN/BM, two side-by-side for
              admin "Both" mode. Each column is wrapped in its own I18nProvider
              so every <Trans>/useLingui child (gallery "TAP TO ZOOM", action
              button labels, date badges, section titles) renders in that
              column's locale — mirroring what a user with that language pref
              would actually see. */}
          {isBothMode ? (
            <View className="flex-row gap-6 mt-2">
              <View className="flex-1 min-w-0" style={{ minWidth: 0 }}>
                <ContestDetailColumn
                  contest={contest}
                  contestTranslation={contestTranslationEn}
                  contestTranslationOwn={contestTranslationEnOwn}
                  language="en"
                  user={user}
                  contestHosts={contestHosts}
                  contestFiles={contestFiles}
                  prizeCategories={prizeCategories}
                  howToEnterCategories={howToEnterCategories}
                  businessCategories={businessCategories}
                  winnerSelectionCategories={winnerSelectionCategories}
                  imageHeight={imageHeight}
                  receiptCount={receiptCount}
                  upvoteCount={publicContestData?.contest?.upvote_count}
                  onManageReceipts={() => setReceiptModalVisible(true)}
                  isDarkColorScheme={isDarkColorScheme}
                  main={main}
                  canEdit={canEditInline}
                  saveContestFields={saveContestFields}
                  saveTranslationField={saveTranslationField}
                />
              </View>
              <View
                className="w-px bg-gray-200 dark:bg-gray-700 self-stretch"
              />
              <View className="flex-1 min-w-0" style={{ minWidth: 0 }}>
                <ContestDetailColumn
                  contest={contest}
                  contestTranslation={contestTranslationMs}
                  contestTranslationOwn={contestTranslationMsOwn}
                  language="ms"
                  user={user}
                  contestHosts={contestHosts}
                  contestFiles={contestFiles}
                  prizeCategories={prizeCategories}
                  howToEnterCategories={howToEnterCategories}
                  businessCategories={businessCategories}
                  winnerSelectionCategories={winnerSelectionCategories}
                  imageHeight={imageHeight}
                  receiptCount={receiptCount}
                  upvoteCount={publicContestData?.contest?.upvote_count}
                  onManageReceipts={() => setReceiptModalVisible(true)}
                  isDarkColorScheme={isDarkColorScheme}
                  main={main}
                  canEdit={canEditInline}
                  saveContestFields={saveContestFields}
                  saveTranslationField={saveTranslationField}
                />
              </View>
            </View>
          ) : (
            <ContestDetailColumn
              contest={contest}
              contestTranslation={contestTranslation}
              contestTranslationOwn={contestTranslationOwn}
              language={effectiveLanguage}
              user={user}
              contestHosts={contestHosts}
              contestFiles={contestFiles}
              prizeCategories={prizeCategories}
              howToEnterCategories={howToEnterCategories}
              businessCategories={businessCategories}
              winnerSelectionCategories={winnerSelectionCategories}
              imageHeight={imageHeight}
              receiptCount={receiptCount}
              upvoteCount={publicContestData?.contest?.upvote_count}
              onManageReceipts={() => setReceiptModalVisible(true)}
              isDarkColorScheme={isDarkColorScheme}
              main={main}
              onActionButtonsLayout={handleActionButtonsLayout}
              canEdit={canEditInline}
              saveContestFields={saveContestFields}
              saveTranslationField={saveTranslationField}
            />
          )}
        </View>
      </ScrollView>

      {/* Receipt Manager Modal (shared — opened from either column's Save button) */}
      {contest && (
        <ReceiptManagerModal
          visible={receiptModalVisible}
          contestId={contest.$id}
          contestTitle={
            effectiveLanguage === 'ms' && contest.title_ms
              ? contest.title_ms
              : contest.title
          }
          onClose={() => setReceiptModalVisible(false)}
        />
      )}
    </>
  )
}

function dateLocaleFor(language: 'en' | 'ms'): string {
  return language === 'ms' ? 'ms-MY' : 'en-MY'
}

// ---------------------------------------------------------------------------
// ContestDetailColumn — full per-locale contest detail view (title, by-line,
// gallery, actions, badges, sections). Wrapped in a locale-scoped I18nProvider
// so child <Trans>/useLingui strings match the column language (EN or BM).
// ---------------------------------------------------------------------------
type ContestDetailColumnProps = {
  contest: Contest
  contestTranslation: ContestTranslationView
  contestTranslationOwn: ContestTranslationView
  language: 'en' | 'ms'
  user: ReturnType<typeof useAuth>['user']
  contestHosts: Host[]
  contestFiles: ContestFile[]
  prizeCategories: Category[]
  howToEnterCategories: Category[]
  businessCategories: Category[]
  winnerSelectionCategories: Category[]
  imageHeight: number
  receiptCount: number
  upvoteCount?: number
  onManageReceipts: () => void
  isDarkColorScheme: boolean
  main: string
  onActionButtonsLayout?: (event: any) => void
  // Admin inline editing (pencil per item). `canEdit` gates all of it.
  canEdit: boolean
  saveContestFields: (
    contestId: string,
    patch: ContestInlinePatch,
  ) => Promise<void>
  saveTranslationField: (
    contestId: string,
    locale: 'en' | 'ms',
    field: TranslationInlineField,
    value: string,
  ) => Promise<void>
}

function ContestDetailColumn(props: ContestDetailColumnProps) {
  const localeI18n = getLocaleScopedI18n(props.language)
  return (
    <I18nProvider i18n={localeI18n}>
      <ContestDetailColumnContent {...props} />
    </I18nProvider>
  )
}

function ContestDetailColumnContent({
  contest,
  contestTranslation,
  contestTranslationOwn,
  language,
  user,
  contestHosts,
  contestFiles,
  prizeCategories,
  howToEnterCategories,
  businessCategories,
  winnerSelectionCategories,
  imageHeight,
  receiptCount,
  upvoteCount,
  onManageReceipts,
  isDarkColorScheme,
  main,
  onActionButtonsLayout,
  canEdit,
  saveContestFields,
  saveTranslationField,
}: ContestDetailColumnProps) {
  const { t } = useLingui()
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const contestTitle =
    language === 'ms' && contest.title_ms ? contest.title_ms : contest.title

  const galleryImages: ImageItem[] = useMemo(
    () =>
      contestFiles.map((file, index) => ({
        id: file.file_id,
        uri: file.file_id,
        tokenSecret: file.token_secret,
        blurhash: file.img_blurhash,
        title: contestTitle,
        description: t`Image ${index + 1} of ${contestFiles.length}`,
      })),
    [contestFiles, contestTitle, t],
  )

  const openGallery = (index: number) => {
    setSelectedImageIndex(index)
    setGalleryVisible(true)
  }

  return (
    <View>
      {/* Title */}
      <View className="mb-2">
        <AdminEditableField
          enabled={canEdit}
          label={language === 'ms' ? 'Title (BM)' : 'Title (EN)'}
          value={language === 'ms' ? (contest.title_ms ?? '') : contest.title}
          multiline={false}
          maxLength={
            language === 'ms'
              ? CONTEST_CHAR_LIMITS.title_ms
              : CONTEST_CHAR_LIMITS.title
          }
          onSave={async (v) => {
            const trimmed = v.trim()
            if (language === 'en' && !trimmed) {
              throw new Error('Title cannot be empty')
            }
            await saveContestFields(
              contest.$id,
              language === 'ms'
                ? { title_ms: trimmed || null }
                : { title: trimmed },
            )
          }}
        >
          <Text className="text-2xl font-bold text-black dark:text-white">
            {contestTitle}
          </Text>
        </AdminEditableField>
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
            {contestFiles.map((file, index) => (
              <GalleryThumbnail
                key={file.file_id}
                source={{ uri: file.file_id }}
                blurhash={file.img_blurhash}
                index={index}
                total={contestFiles.length}
                onPress={() => openGallery(index)}
                width={280}
                height={imageHeight}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Action Buttons Row */}
      <View
        className="mb-4"
        onLayout={onActionButtonsLayout}
        style={{ marginHorizontal: -12 }}
      >
        <View className="flex-row items-center justify-center md:justify-start">
          <UpvoteButton
            contestId={contest.$id}
            variant="default"
            showCount={true}
            initialCount={upvoteCount}
          />
          <View style={{ width: 20 }} />
          <SaveButton
            contestId={contest.$id}
            variant="default"
            showText={true}
            receiptCount={receiptCount}
            onManageReceipts={onManageReceipts}
            contestTitle={contestTitle}
          />
          <View style={{ width: 20 }} />
          <ShareButton
            contestId={contest.slug}
            contestTitle={contestTitle}
            language={language}
            variant="default"
          />
        </View>
      </View>

      {/* Contest Badges - End Date and Business Category */}
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
          style={{ marginHorizontal: -2 }}
        >
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

      <ContestDetailSections
        contest={contest}
        contestTranslation={contestTranslation}
        contestTranslationOwn={contestTranslationOwn}
        language={language}
        user={user}
        prizeCategories={prizeCategories}
        howToEnterCategories={howToEnterCategories}
        winnerSelectionCategories={winnerSelectionCategories}
        main={main}
        isDarkColorScheme={isDarkColorScheme}
        canEdit={canEdit}
        saveContestFields={saveContestFields}
        saveTranslationField={saveTranslationField}
      />

      <ImageGallery
        images={galleryImages}
        initialIndex={selectedImageIndex}
        isVisible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Admin-only language toggle: segmented EN / BM / View Both / Edit Both
// control. Rendered in the contest detail header next to the Admin Only
// badge; non-admins never see it. Edit Both is the only mode with pencils.
// ---------------------------------------------------------------------------
function AdminLanguageToggle({
  value,
  onChange,
}: {
  value: AdminLangMode
  onChange: (mode: AdminLangMode) => void
}) {
  const options: Array<{ key: AdminLangMode; label: string }> = [
    { key: 'en', label: 'EN' },
    { key: 'ms', label: 'BM' },
    { key: 'both', label: 'View Both' },
    { key: 'both-edit', label: 'Edit Both' },
  ]
  return (
    <View className="flex-row items-center rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
      {options.map((opt, idx) => {
        const active = value === opt.key
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`px-2.5 py-1 ${active ? 'bg-main' : 'bg-transparent'}`}
            style={{
              borderLeftWidth: idx === 0 ? 0 : 1,
              borderLeftColor: 'rgba(0,0,0,0.1)',
            }}
          >
            <Text
              className={`text-xs font-semibold ${
                active
                  ? 'text-white'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// ContestDetailSections — the translation-dependent body of the contest
// detail page (dates, eligibility, prizes, entry method, winners, additional
// info). Extracted so the page can render it twice side-by-side when an admin
// picks the "Both" language mode, once per locale with no fallback mixing.
// ---------------------------------------------------------------------------
type ContestDetailSectionsProps = {
  contest: Contest
  contestTranslation: ContestTranslationView
  contestTranslationOwn: ContestTranslationView
  language: 'en' | 'ms'
  user: ReturnType<typeof useAuth>['user']
  prizeCategories: Category[]
  howToEnterCategories: Category[]
  winnerSelectionCategories: Category[]
  main: string
  isDarkColorScheme: boolean
  canEdit: boolean
  saveContestFields: (
    contestId: string,
    patch: ContestInlinePatch,
  ) => Promise<void>
  saveTranslationField: (
    contestId: string,
    locale: 'en' | 'ms',
    field: TranslationInlineField,
    value: string,
  ) => Promise<void>
}

function ContestDetailSections({
  contest,
  contestTranslation,
  contestTranslationOwn,
  language,
  user,
  prizeCategories,
  howToEnterCategories,
  winnerSelectionCategories,
  main,
  isDarkColorScheme,
  canEdit,
  saveContestFields,
  saveTranslationField,
}: ContestDetailSectionsProps) {
  const { t } = useLingui()

  // Inline-edit helpers, bound to this column's contest + locale. `langLabel`
  // disambiguates which locale a pencil writes to (esp. in "Both" mode).
  const langLabel = language === 'ms' ? 'BM' : 'EN'
  const requiredEnTranslationFields = new Set<TranslationInlineField>([
    'prizes',
    'eligible_products_and_purchases',
    'eligible_participants',
    'eligible_stores',
    'entry_method_and_submission',
    'winners_selection_method',
    'winners_comm_and_timeline',
    'winners_list_and_announcement',
  ])
  const saveT = (field: TranslationInlineField) => async (value: string) => {
    const trimmed = value.trim()
    if (
      language === 'en' &&
      requiredEnTranslationFields.has(field) &&
      !trimmed
    ) {
      throw new Error(`${field} (EN) cannot be empty`)
    }
    await saveTranslationField(contest.$id, language, field, trimmed)
  }
  const savePrizeValue = async (v: string) => {
    const trimmed = v.trim()
    const n = Number(trimmed.replace(/[,\s]|RM/gi, ''))
    if (trimmed !== '' && (!Number.isFinite(n) || n < 0)) {
      throw new Error('Enter a non-negative number')
    }
    await saveContestFields(contest.$id, {
      total_prizes_value_rm: trimmed === '' || n === 0 ? null : n,
    })
  }
  // URL fields (T&C/FAQ per locale; social links shared) mirror the create
  // form's optionalUrl rule: empty clears, otherwise must be http(s).
  const assertUrl = (value: string) => {
    if (value && !/^https?:\/\/.+/.test(value)) {
      throw new Error('Must be a valid URL starting with http(s)://')
    }
  }
  const saveUrlT = (field: TranslationInlineField) => async (value: string) => {
    const trimmed = value.trim()
    assertUrl(trimmed)
    await saveTranslationField(contest.$id, language, field, trimmed)
  }
  const saveSocialLink =
    (field: keyof ContestInlinePatch) => async (value: string) => {
      const trimmed = value.trim()
      assertUrl(trimmed)
      await saveContestFields(contest.$id, { [field]: trimmed || null })
    }

  const formatPrizeValue = (amount: number): string => {
    const rounded = Math.ceil(amount)
    if (rounded >= 1000000) {
      const millions = rounded / 1000000
      if (millions >= 10) return `RM ${Math.round(millions)}mil`
      return `RM ${millions.toFixed(1)}mil`
    } else if (rounded >= 1000) {
      const thousands = Math.round(rounded / 1000)
      return `RM ${thousands}k`
    }
    return `RM ${rounded}`
  }

  return (
    <View className="flex-col gap-4">
      {/* Summary (contest-level) keeps parity with title/date inline editing.
          EN is required for publish; BM remains optional. */}
      <Card>
        <CardHeader>
          <Trans>
            <CardTitle className="text-lg">Summary</CardTitle>
          </Trans>
        </CardHeader>
        <CardContent>
          <AdminEditableField
            enabled={canEdit}
            label={`Summary (${langLabel})`}
            value={language === 'ms' ? (contest.summary_ms ?? '') : contest.summary}
            maxLength={
              language === 'ms'
                ? CONTEST_CHAR_LIMITS.summary_ms
                : CONTEST_CHAR_LIMITS.summary
            }
            onSave={async (v) => {
              const trimmed = v.trim()
              if (language === 'en' && !trimmed) {
                throw new Error('Summary cannot be empty')
              }
              await saveContestFields(
                contest.$id,
                language === 'ms'
                  ? { summary_ms: trimmed || null }
                  : { summary: trimmed },
              )
            }}
          >
            {(() => {
              const summaryText =
                language === 'ms' && contest.summary_ms
                  ? contest.summary_ms
                  : contest.summary
              return summaryText ? (
                <Text className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {summaryText}
                </Text>
              ) : null
            })()}
          </AdminEditableField>
        </CardContent>
      </Card>

      <AdminEditableDateRange
        enabled={canEdit}
        startValue={contest.start_date}
        endValue={contest.end_date}
        onSave={(startIso, endIso) =>
          saveContestFields(contest.$id, {
            start_date: startIso,
            end_date: endIso,
          })
        }
      >
      <View className="flex-row justify-between">
        <View className="flex-1 mr-2">
          <Trans>
            <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Start Date
            </Text>
          </Trans>
          <Text className="text-black dark:text-white text-sm">
            {new Date(contest.start_date).toLocaleDateString(
              dateLocaleFor(language),
              {
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
            {new Date(contest.end_date).toLocaleDateString(
              dateLocaleFor(language),
              {
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
      </AdminEditableDateRange>

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
          {(contestTranslation?.eligible_participants || canEdit) && (
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
                          {contestTranslation.eligible_participants_exclusion}
                        </MarkdownText>
                      </View>
                    </PopoverContent>
                  </Popover>
                )}
              </View>
              <AdminEditableField
                enabled={canEdit}
                label={`Eligible participants (${langLabel})`}
                value={contestTranslationOwn?.eligible_participants}
                maxLength={TRANSLATION_CHAR_LIMITS.eligible_participants}
                onSave={saveT('eligible_participants')}
              >
                {contestTranslation?.eligible_participants ? (
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.eligible_participants}
                  </MarkdownText>
                ) : null}
              </AdminEditableField>
              {/* Admins get the exclusion text inline (users read it via the
                  popover above) so it can be reviewed and edited in place. */}
              {canEdit && (
                <View className="mt-2">
                  <AdminEditableField
                    enabled={canEdit}
                    label={`Participant exclusions (${langLabel})`}
                    value={
                      contestTranslationOwn?.eligible_participants_exclusion
                    }
                    maxLength={
                      TRANSLATION_CHAR_LIMITS.eligible_participants_exclusion
                    }
                    onSave={saveT('eligible_participants_exclusion')}
                  >
                    {contestTranslation?.eligible_participants_exclusion ? (
                      <MarkdownText className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        {contestTranslation.eligible_participants_exclusion}
                      </MarkdownText>
                    ) : null}
                  </AdminEditableField>
                </View>
              )}
            </View>
          )}

          {/* Eligible Products and Purchases */}
          {(contestTranslation?.eligible_products_and_purchases || canEdit) && (
            <View>
              <Trans>
                <Text className="text-base font-semibold text-black dark:text-white mb-2">
                  💳 Eligible Purchases & Products 🛍️
                </Text>
              </Trans>
              <AdminEditableField
                enabled={canEdit}
                label={`Eligible purchases & products (${langLabel})`}
                value={contestTranslationOwn?.eligible_products_and_purchases}
                maxLength={TRANSLATION_CHAR_LIMITS.eligible_products}
                onSave={saveT('eligible_products_and_purchases')}
              >
                {contestTranslation?.eligible_products_and_purchases ? (
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.eligible_products_and_purchases}
                  </MarkdownText>
                ) : null}
              </AdminEditableField>
            </View>
          )}

          {/* Eligible Stores */}
          {(contestTranslation?.eligible_stores || canEdit) && (
            <View>
              <Trans>
                <Text className="text-base font-semibold text-black dark:text-white mb-2">
                  🛒 Eligible Stores
                </Text>
              </Trans>
              <AdminEditableField
                enabled={canEdit}
                label={`Eligible stores (${langLabel})`}
                value={contestTranslationOwn?.eligible_stores}
                maxLength={TRANSLATION_CHAR_LIMITS.eligible_stores}
                onSave={saveT('eligible_stores')}
              >
                {contestTranslation?.eligible_stores ? (
                  <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {contestTranslation.eligible_stores}
                  </MarkdownText>
                ) : null}
              </AdminEditableField>
            </View>
          )}

          {/* Eligible Online Stores */}
          {(contest?.link_aff_shopee ||
            contest?.link_aff_lazada ||
            contest?.link_aff_tiktok_shop ||
            canEdit) && (
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
                          : { backgroundColor: main + '1A' }
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
                          Eligible Stores (with potential to earn JomPoints)
                        </Text>
                      </Trans>
                      <Trans>
                        <Text className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          Shop link(s) provided below are affiliate link(s),
                          depending on the terms and conditions, a purchase
                          coming from the link(s) may or may not be rewarded. If
                          it is rewarded, we will credit a proportion of the
                          reward to you as JomPoints. This feature is still in
                          Beta, and we are not liable for any discrepancies or
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
                      <Text className="text-white font-medium">Shopee</Text>
                    </View>
                  </Link>
                )}
                {contest?.link_aff_lazada && (
                  <Link href={contest.link_aff_lazada}>
                    <View className="bg-[#D4145A] px-4 py-2 rounded-lg">
                      <Text className="text-white font-medium">Lazada</Text>
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

              {/* Admin inline editing for the affiliate links. Contest-level
                  values, so each editor is marked shared. */}
              {canEdit && (
                <View className="mt-3 gap-2">
                  {(
                    [
                      {
                        field: 'link_aff_shopee',
                        label: 'Shopee affiliate link',
                      },
                      {
                        field: 'link_aff_lazada',
                        label: 'Lazada affiliate link',
                      },
                      {
                        field: 'link_aff_tiktok_shop',
                        label: 'TikTok Shop affiliate link',
                      },
                    ] as const
                  ).map(({ field, label }) => (
                    <AdminEditableField
                      key={field}
                      enabled={canEdit}
                      label={label}
                      value={contest[field] ?? ''}
                      multiline={false}
                      shared
                      maxLength={CONTEST_CHAR_LIMITS[field]}
                      onSave={saveSocialLink(field)}
                    >
                      {contest[field] ? (
                        <Text
                          numberOfLines={1}
                          className="text-xs text-gray-600 dark:text-gray-400"
                        >
                          {label}: {contest[field]}
                        </Text>
                      ) : null}
                    </AdminEditableField>
                  ))}
                </View>
              )}
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
            prizeCategories.length > 0 ||
            canEdit) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="ml-2"
              contentContainerStyle={{ alignItems: 'center' }}
            >
              <View className="mr-2">
                <AdminEditableField
                  enabled={canEdit}
                  label="Total prizes value (RM)"
                  value={
                    (contest.total_prizes_value_rm ?? 0) > 0
                      ? String(contest.total_prizes_value_rm)
                      : ''
                  }
                  multiline={false}
                  shared
                  onSave={savePrizeValue}
                >
                  {(contest.total_prizes_value_rm ?? 0) > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
                    >
                      <Text className="text-yellow-700 dark:text-yellow-300 font-medium">
                        <Trans>Worth:</Trans>{' '}
                        {formatPrizeValue(contest.total_prizes_value_rm!)}
                      </Text>
                    </Badge>
                  ) : null}
                </AdminEditableField>
              </View>
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
        <AdminEditableField
          enabled={canEdit}
          label={`Prizes (${langLabel})`}
          value={contestTranslationOwn?.prizes}
          maxLength={TRANSLATION_CHAR_LIMITS.prizes}
          onSave={saveT('prizes')}
        >
          {contestTranslation?.prizes ? (
            <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {contestTranslation.prizes}
            </MarkdownText>
          ) : null}
        </AdminEditableField>
      </View>

      {/* Entry Method and Submission */}
      {(contestTranslation?.entry_method_and_submission || canEdit) && (
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
            <AdminEditableField
              enabled={canEdit}
              label={`How to enter (${langLabel})`}
              value={contestTranslationOwn?.entry_method_and_submission}
              maxLength={TRANSLATION_CHAR_LIMITS.entry_method}
              onSave={saveT('entry_method_and_submission')}
            >
              {contestTranslation?.entry_method_and_submission ? (
                <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contestTranslation.entry_method_and_submission}
                </MarkdownText>
              ) : null}
            </AdminEditableField>
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
      {user && (contestTranslation?.winners_selection_method || canEdit) && (
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
            <AdminEditableField
              enabled={canEdit}
              label={`Winners selection method (${langLabel})`}
              value={contestTranslationOwn?.winners_selection_method}
              maxLength={TRANSLATION_CHAR_LIMITS.winners_selection_method}
              onSave={saveT('winners_selection_method')}
            >
              {contestTranslation?.winners_selection_method ? (
                <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contestTranslation.winners_selection_method}
                </MarkdownText>
              ) : null}
            </AdminEditableField>
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
                    Sign in or register to view winners communication details
                  </Trans>
                </Text>
              </View>
            </Link>
          </View>
        </>
      )}
      {user && (contestTranslation?.winners_comm_and_timeline || canEdit) && (
        <>
          <Separator />
          <View>
            <Trans>
              <Text className="text-lg font-semibold text-black dark:text-white mb-2">
                Winners Communication Channel & Timeline
              </Text>
            </Trans>
            <AdminEditableField
              enabled={canEdit}
              label={`Winners communication & timeline (${langLabel})`}
              value={contestTranslationOwn?.winners_comm_and_timeline}
              maxLength={TRANSLATION_CHAR_LIMITS.winners_comm_and_timeline}
              onSave={saveT('winners_comm_and_timeline')}
            >
              {contestTranslation?.winners_comm_and_timeline ? (
                <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contestTranslation.winners_comm_and_timeline}
                </MarkdownText>
              ) : null}
            </AdminEditableField>
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
                    Sign in or register to view winners announcement details
                  </Trans>
                </Text>
              </View>
            </Link>
          </View>
        </>
      )}
      {user && (contestTranslation?.winners_list_and_announcement || canEdit) && (
        <>
          <Separator />
          <View>
            <Trans>
              <Text className="text-lg font-semibold text-black dark:text-white mb-2">
                Winners List & Announcement
              </Text>
            </Trans>
            <AdminEditableField
              enabled={canEdit}
              label={`Winners list & announcement (${langLabel})`}
              value={contestTranslationOwn?.winners_list_and_announcement}
              maxLength={
                TRANSLATION_CHAR_LIMITS.winners_list_and_announcement
              }
              onSave={saveT('winners_list_and_announcement')}
            >
              {contestTranslation?.winners_list_and_announcement ? (
                <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contestTranslation.winners_list_and_announcement}
                </MarkdownText>
              ) : null}
            </AdminEditableField>
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
                    Sign in or register to view additional important information
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
          contest?.link_media_website ||
          canEdit) && (
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
                contestTranslation?.link_faq ||
                canEdit) && (
                <View className="flex-row flex-wrap gap-4 mb-4">
                  {/* Seed the editors with this locale's own link only — the
                      displayed value may be the other locale's fallback, and
                      saving that here would copy it across locales. */}
                  <AdminEditableField
                    enabled={canEdit}
                    label={`T&C link (${langLabel})`}
                    value={contestTranslationOwn?.link_tnc ?? ''}
                    multiline={false}
                    maxLength={TRANSLATION_CHAR_LIMITS.link_tnc}
                    onSave={saveUrlT('link_tnc')}
                  >
                  {contestTranslation?.link_tnc ? (
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
                            Platform.OS === 'web' ? undefined : { color: main }
                          }
                        >
                          {language === 'ms'
                            ? 'Terma & Syarat'
                            : 'Terms & Conditions'}
                        </Text>
                      </Link>
                      {(() => {
                        const tncLocale = contestTranslation.link_tnc_locale
                        const isFallback = tncLocale !== language
                        if (!isFallback) return null
                        if (language === 'ms' && tncLocale === 'en') {
                          return (
                            <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                              (dalam Bahasa Inggeris sahaja)
                            </Text>
                          )
                        } else if (language === 'en' && tncLocale === 'ms') {
                          return (
                            <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                              (in Bahasa Malaysia only)
                            </Text>
                          )
                        }
                        return null
                      })()}
                    </View>
                  ) : null}
                  </AdminEditableField>
                  <AdminEditableField
                    enabled={canEdit}
                    label={`FAQ link (${langLabel})`}
                    value={contestTranslationOwn?.link_faq ?? ''}
                    multiline={false}
                    maxLength={TRANSLATION_CHAR_LIMITS.link_faq}
                    onSave={saveUrlT('link_faq')}
                  >
                  {contestTranslation?.link_faq ? (
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
                            Platform.OS === 'web' ? undefined : { color: main }
                          }
                        >
                          {language === 'ms' ? 'Soalan Lazim' : 'FAQ'}
                        </Text>
                      </Link>
                      {(() => {
                        const faqLocale = contestTranslation.link_faq_locale
                        const isFallback = faqLocale !== language
                        if (!isFallback) return null
                        if (language === 'ms' && faqLocale === 'en') {
                          return (
                            <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                              (dalam Bahasa Inggeris sahaja)
                            </Text>
                          )
                        } else if (language === 'en' && faqLocale === 'ms') {
                          return (
                            <Text className="text-gray-600 dark:text-gray-400 text-sm ml-1">
                              (in Bahasa Malaysia only)
                            </Text>
                          )
                        }
                        return null
                      })()}
                    </View>
                  ) : null}
                  </AdminEditableField>
                </View>
              )}

              {/* Social Media Links */}
              {(contest?.link_media_instagram ||
                contest?.link_media_facebook ||
                contest?.link_media_tiktok ||
                contest?.link_media_x ||
                contest?.link_media_youtube ||
                contest?.link_media_linkedin ||
                contest?.link_media_website ||
                canEdit) && (
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
                        <Link href={contest.link_media_instagram} target="_blank">
                          <View className="p-2">
                            <InstagramSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_facebook && (
                        <Link href={contest.link_media_facebook} target="_blank">
                          <View className="p-2">
                            <FacebookSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_tiktok && (
                        <Link href={contest.link_media_tiktok} target="_blank">
                          <View className="p-2">
                            <TikTokSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_x && (
                        <Link href={contest.link_media_x} target="_blank">
                          <View className="p-2">
                            <XSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_youtube && (
                        <Link href={contest.link_media_youtube} target="_blank">
                          <View className="p-2">
                            <YouTubeSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_linkedin && (
                        <Link href={contest.link_media_linkedin} target="_blank">
                          <View className="p-2">
                            <LinkedInSolid width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                      {contest?.link_media_website && (
                        <Link href={contest.link_media_website} target="_blank">
                          <View className="p-2">
                            <GlobeAltOutline width={28} height={28} color={isDarkColorScheme ? '#e5e5e5' : '#1f2937'} />
                          </View>
                        </Link>
                      )}
                    </View>

                    {/* Admin inline editing for the social/website links.
                        Contest-level values, so each editor is marked shared. */}
                    {canEdit && (
                      <View className="mt-4 gap-2">
                        {(
                          [
                            {
                              field: 'link_media_instagram',
                              label: 'Instagram link',
                            },
                            {
                              field: 'link_media_facebook',
                              label: 'Facebook link',
                            },
                            {
                              field: 'link_media_tiktok',
                              label: 'TikTok link',
                            },
                            {
                              field: 'link_media_x',
                              label: 'X (Twitter) link',
                            },
                            {
                              field: 'link_media_youtube',
                              label: 'YouTube link',
                            },
                            {
                              field: 'link_media_linkedin',
                              label: 'LinkedIn link',
                            },
                            {
                              field: 'link_media_website',
                              label: 'Website link',
                            },
                          ] as const
                        ).map(({ field, label }) => (
                          <AdminEditableField
                            key={field}
                            enabled={canEdit}
                            label={label}
                            value={contest[field] ?? ''}
                            multiline={false}
                            shared
                            maxLength={CONTEST_CHAR_LIMITS[field]}
                            onSave={saveSocialLink(field)}
                          >
                            {contest[field] ? (
                              <Text
                                numberOfLines={1}
                                className="text-xs text-gray-600 dark:text-gray-400"
                              >
                                {label}: {contest[field]}
                              </Text>
                            ) : null}
                          </AdminEditableField>
                        ))}
                      </View>
                    )}
                  </CardContent>
                </Card>
              )}
            </View>
          </>
        )}
    </View>
  )
}
