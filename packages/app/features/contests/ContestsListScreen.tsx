import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import {
  View,
  ActivityIndicator,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Query, Models } from 'app/lib/appwrite-universal'
import { Trans, useLingui } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'app/components/ui/card'
import { Button } from 'app/components/ui/button'
import { tablesDB, account } from 'app/provider/appwrite/api'
import { useAuth } from 'app/contexts/AuthContext'
import { useRouter } from 'app/lib/router-universal'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useIsAdmin } from 'app/hooks/useIsAdmin'
import {
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_CATEGORIES_COLLECTION_ID,
} from 'app/provider/appwrite/constants'

import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useContestNavigation } from 'app/hooks/useContestNavigation'
import { type ContestBadgeCategory } from 'app/features/contest/components/ContestBadges'
import { ContestCard } from 'app/features/contest/components/ContestCard'
import { Skeleton } from 'app/components/ui/skeleton'
import { useReceiptStats } from 'app/hooks/useReceipts'
import ReceiptManagerModal from 'app/features/profile/components/ReceiptManagerModal'
import { usePublicContests } from 'app/hooks/usePublicContests'
import {
  CategoryFilter,
  type FilterCategory,
} from 'app/components/CategoryFilter'

// Constants for pagination
const CONTESTS_PER_PAGE = 50

// Authentication required message component

// Define types for contests and contest files
type Contest = Models.Document & {
  title: string
  title_ms?: string
  summary: string
  summary_ms?: string
  start_date: string
  end_date: string
  main_img_id?: string
  main_img_token_secret?: string
  main_img_blurhash?: string
  host_ids?: string[]
  category_ids?: string[]
  slug?: string
  visibility?: 'any' | 'users' | 'admin'
}

// Host type for contest hosts
type Host = Models.Document & {
  name: string
  slug: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash?: string
  bio?: string
}

type Category = Models.Document & {
  slug: string
  name_en: string
  name_ms: string
  priority_order?: number
  type?:
    | 'prize'
    | 'winner_selection'
    | 'how_to_enter'
    | 'business_category'
    | null
}

interface ContestListScreenProps {
  hideTopPadding?: boolean
}

export default function ContestsListScreen({
  hideTopPadding = false,
}: ContestListScreenProps) {
  const { t } = useLingui()
  const { top, bottom } = useSafeArea()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const router = useRouter()

  // Width detection for responsive columns
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width)
  const TWO_COLUMN_THRESHOLD = 800 // Suggested width for switching to 2 columns

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width)
    })

    return () => subscription?.remove()
  }, [])

  const numColumns = screenWidth >= TWO_COLUMN_THRESHOLD ? 2 : 1

  // Use the navigation hook for scroll position management
  const { navigateToContest } = useContestNavigation({
    baseUrl: '/', // Home page is at root
  })

  // Get authentication state
  const { user, isLoading: isLoadingUser } = useAuth()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin()

  // Category filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )

  // Fetch prize and winner_selection type categories for the filter bar (authenticated users only)
  const { data: authFilterCategories = [] } = useQuery<FilterCategory[]>({
    queryKey: ['filter-categories'],
    enabled: !!user, // Only run for authenticated users
    queryFn: async () => {
      // Fetch prize (🏆 Cash, 💻 Macbook, etc.) and winner_selection (🎟️ Entry Rank, etc.) types
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTEST_CATEGORIES_COLLECTION_ID,
        queries: [
          Query.contains('type', ['prize', 'winner_selection']),
          Query.orderAsc('priority_order'),
          Query.limit(50),
        ],
      })
      return res.rows as unknown as FilterCategory[]
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000,
  })

  // PUBLIC CONTESTS QUERY (for anonymous users) ------------------------------------
  const {
    data: publicContestsData,
    isLoading: isLoadingPublicContests,
    isError: isErrorPublicContests,
    refetch: refetchPublicContests,
  } = usePublicContests({
    limit: 10, // Show up to 10 public contests for anonymous users
    enabled: !user && !isLoadingUser, // Only run when user is NOT authenticated
  })

  // Extract filter categories from public contests for anonymous users
  const publicFilterCategories = useMemo(() => {
    if (user || !publicContestsData) return []
    const categoriesMap = new Map<string, FilterCategory>()
    publicContestsData.forEach((contest: any) => {
      ;(contest.categories || []).forEach((cat: any) => {
        // Only include prize and winner_selection types
        if (cat.type === 'prize' || cat.type === 'winner_selection') {
          if (!categoriesMap.has(cat.$id)) {
            categoriesMap.set(cat.$id, {
              $id: cat.$id,
              name_en: cat.name_en,
              name_ms: cat.name_ms,
              slug: cat.slug,
              priority_order: cat.priority_order,
              type: cat.type, // Include type for two-row layout
            })
          }
        }
      })
    })
    return Array.from(categoriesMap.values())
  }, [user, publicContestsData])

  // Unified filter categories (authenticated or anonymous)
  const filterCategories = user ? authFilterCategories : publicFilterCategories

  // MAIN LIST QUERY (for authenticated users) with infinite scroll --------------------------------------
  const {
    data: authContestsData,
    isLoading: isLoadingAuthContests,
    isError: isErrorAuthContests,
    refetch: refetchAuthContests,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['contests', isAdmin],
    enabled: !!user && !isLoadingAdmin,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // Admin users see all contests (any, users, admin visibility)
      // Regular users see contests with visibility='any' or visibility='users'
      // Sort by most recently added first
      const queries = isAdmin
        ? [Query.orderDesc('$createdAt'), Query.limit(CONTESTS_PER_PAGE)]
        : [
            Query.contains('visibility', ['any', 'users']),
            Query.orderDesc('$createdAt'),
            Query.limit(CONTESTS_PER_PAGE),
          ]

      // Add cursor for pagination
      if (pageParam) {
        queries.push(Query.cursorAfter(pageParam))
      }

      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTESTS_COLLECTION_ID,
        queries,
      })
      return res.rows as unknown as Contest[]
    },
    getNextPageParam: (lastPage) => {
      // Return the last item's ID as cursor if we got a full page
      if (lastPage.length === CONTESTS_PER_PAGE) {
        return lastPage[lastPage.length - 1]?.$id
      }
      return undefined
    },
  })

  // Flatten paginated data into single array
  const authContests = useMemo(() => {
    return authContestsData?.pages.flat() ?? []
  }, [authContestsData])

  // Unified contests list (public or authenticated)
  const allContests = useMemo(() => {
    if (user) {
      return authContests
    }
    // publicContestsData is EnrichedPublicContest[] directly
    return (publicContestsData || []) as unknown as Contest[]
  }, [user, authContests, publicContestsData])

  // Filter categories to only show those that have at least one contest
  const availableFilterCategories = useMemo(() => {
    if (!filterCategories.length || !allContests.length) return []

    // Get all category IDs that appear in at least one contest
    const categoryIdsWithContests = new Set<string>()
    allContests.forEach((contest) => {
      // For authenticated users: use category_ids
      // For anonymous users: public contests have embedded categories array
      const contestAny = contest as any
      if (contestAny.category_ids) {
        contestAny.category_ids.forEach((id: string) =>
          categoryIdsWithContests.add(id),
        )
      } else if (contestAny.categories) {
        // Anonymous users - extract IDs from embedded categories
        contestAny.categories.forEach((cat: any) =>
          categoryIdsWithContests.add(cat.$id),
        )
      }
    })

    // Only include categories that have contests
    return filterCategories.filter((cat) =>
      categoryIdsWithContests.has(cat.$id),
    )
  }, [filterCategories, allContests])

  // Client-side category filtering
  const contests = useMemo(() => {
    if (!selectedCategoryId) {
      return allContests // "All" is selected
    }
    return allContests.filter((contest) => {
      const contestAny = contest as any
      // For authenticated users: use category_ids
      if (contestAny.category_ids) {
        return contestAny.category_ids.includes(selectedCategoryId)
      }
      // For anonymous users: check embedded categories array
      if (contestAny.categories) {
        return contestAny.categories.some(
          (cat: any) => cat.$id === selectedCategoryId,
        )
      }
      return false
    })
  }, [allContests, selectedCategoryId])

  // Early fetch: if filtered results are low and we can fetch more, do it
  useEffect(() => {
    if (
      user &&
      selectedCategoryId &&
      contests.length < 10 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    user,
    selectedCategoryId,
    contests.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  // Unified loading state
  const isLoadingContests = user
    ? isLoadingAuthContests || isLoadingAdmin
    : isLoadingPublicContests
  const isErrorContests = user ? isErrorAuthContests : isErrorPublicContests
  const refetchContests = user ? refetchAuthContests : refetchPublicContests

  // Fetch all host docs referenced by ALL contests (batch) --------------------------------
  // Use allContests (pre-filter) so switching category chips doesn't trigger re-fetches
  const allHostIds = useMemo(() => {
    const set = new Set<string>()
    allContests.forEach((c) => (c.host_ids || []).forEach((id) => set.add(id)))
    return Array.from(set)
  }, [allContests])

  // For authenticated users, fetch hosts from database
  // For anonymous users, hosts are already included in publicContestsData
  const { data: authHosts = [] } = useQuery<Host[]>({
    queryKey: ['contest-hosts', allHostIds.sort().join(',')],
    enabled: !!user && allHostIds.length > 0,
    queryFn: async () => {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTEST_HOSTS_COLLECTION_ID,
        queries: [Query.equal('$id', allHostIds), Query.limit(100)],
      })
      // Sort hosts to ensure consistent ordering in hostsById map
      const hosts = res.rows as unknown as Host[]
      return hosts.sort(
        (a, b) => allHostIds.indexOf(a.$id) - allHostIds.indexOf(b.$id),
      )
    },
  })

  // Unified hosts list
  const allHosts = useMemo(() => {
    if (user) {
      return authHosts
    }
    // Extract hosts from each public contest's embedded hosts
    const hostsMap = new Map<string, Host>()
    ;(publicContestsData || []).forEach((c) => {
      ;(c.hosts || []).forEach((h) => {
        if (!hostsMap.has(h.$id)) {
          hostsMap.set(h.$id, {
            $id: h.$id,
            name: h.name,
            slug: h.slug,
            img_id: h.img_id,
            img_token_secret: h.img_token_secret,
            img_blurhash: h.img_blurhash,
          } as unknown as Host)
        }
      })
    })
    return Array.from(hostsMap.values())
  }, [user, authHosts, publicContestsData])

  const hostsById = useMemo(() => {
    const m = new Map<string, Host>()
    allHosts.forEach((h) => m.set(h.$id, h))
    return m
  }, [allHosts])

  // Fetch all categories referenced by ALL contests (batch)
  // Use allContests (pre-filter) so switching category chips doesn't trigger re-fetches
  const allCategoryIds = useMemo(() => {
    const set = new Set<string>()
    allContests.forEach((c) =>
      (c.category_ids || []).forEach((id) => set.add(id)),
    )
    return Array.from(set)
  }, [allContests])

  // For authenticated users, fetch categories from database
  // For anonymous users, categories are already included in publicContestsData
  const { data: authCategories = [] } = useQuery<Category[]>({
    queryKey: ['contest-categories', allCategoryIds.sort().join(',')],
    enabled: !!user && allCategoryIds.length > 0,
    queryFn: async () => {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTEST_CATEGORIES_COLLECTION_ID,
        queries: [Query.equal('$id', allCategoryIds), Query.limit(200)],
      })
      return res.rows as unknown as Category[]
    },
  })

  // Unified categories list
  const allCategories = useMemo(() => {
    if (user) {
      return authCategories
    }
    // Extract categories from each public contest's embedded categories
    const categoriesMap = new Map<string, Category>()
    ;(publicContestsData || []).forEach((c) => {
      ;(c.categories || []).forEach((cat) => {
        if (!categoriesMap.has(cat.$id)) {
          categoriesMap.set(cat.$id, {
            $id: cat.$id,
            name_en: cat.name_en,
            name_ms: cat.name_ms,
            slug: cat.slug,
            priority_order: cat.priority_order,
            type: cat.type,
          } as unknown as Category)
        }
      })
    })
    return Array.from(categoriesMap.values())
  }, [user, authCategories, publicContestsData])

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>()
    allCategories.forEach((c) => m.set(c.$id, c))
    return m
  }, [allCategories])

  // Note: Contest Files query removed - now using main image from contests directly
  // Contest Files will only be fetched when needed for deletion

  // error wrapper
  const error = isErrorContests ? 'Failed to fetch contests' : null

  // Fetch receipt stats for badge counts (only for authenticated users)
  const { data: receiptStats } = useReceiptStats()

  // Fetch receipt counts for all contests with receipts
  const { data: receiptCounts = {} } = useQuery<Record<string, number>>({
    queryKey: [
      'receipts',
      'counts',
      user?.$id,
      receiptStats?.contestsWithReceipts,
    ],
    queryFn: async () => {
      if (!user?.$id || !receiptStats?.contestsWithReceipts.length) {
        return {}
      }

      const { getContestReceiptCount } = await import('app/lib/receipts/api')
      const counts: Record<string, number> = {}

      // Fetch counts for all contests with receipts
      await Promise.all(
        receiptStats.contestsWithReceipts.map(async (contestId) => {
          try {
            const count = await getContestReceiptCount(user.$id, contestId)
            counts[contestId] = count
          } catch (error) {
            console.error(
              `Failed to get receipt count for contest ${contestId}:`,
              error,
            )
            counts[contestId] = 0
          }
        }),
      )

      return counts
    },
    enabled: !!user?.$id && !!receiptStats?.contestsWithReceipts.length,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const [jwt, setJwt] = useState<string | null>(null) // for android only (see notes at bottom)
  const [receiptModalVisible, setReceiptModalVisible] = useState(false)
  const [selectedContestForReceipt, setSelectedContestForReceipt] =
    useState<Contest | null>(null)

  // Language preference via Appwrite Account Preferences
  const { data: language = 'en' } = useQuery<'en' | 'ms'>({
    queryKey: ['user-language-preference'],
    queryFn: async () => {
      try {
        const prefs = await account.getPrefs()
        const lang = (prefs as any)?.language || 'en'
        return lang === 'ms' ? 'ms' : 'en'
      } catch {
        return 'en'
      }
    },
    enabled: !!user, // Only fetch when user is logged in
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
  if (Platform.OS === 'android') {
    useEffect(() => {
      if (!user) return
      const fetchJWT = async () => {
        try {
          const { jwt } = await account.createJWT()
          setJwt(jwt)
        } catch {
          // Not authenticated or JWT creation failed; jwt stays null
        }
      }
      fetchJWT()
    }, [user])
  }

  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = async () => {
    setRefreshing(true)
    await refetchContests()
    setRefreshing(false)
  }

  // Load more contests when reaching end of list
  const onEndReached = useCallback(() => {
    if (user && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [user, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId)
  }, [])

  // For anonymous users: show public contests with sign-in prompt
  // Note: We no longer block anonymous users completely - they can view public contests

  if (isLoadingContests || isLoadingUser) {
    return (
      <View
        className="flex-1 dark:bg-black bg-white"
        style={{
          paddingTop: hideTopPadding ? 0 : Platform.OS === 'web' ? 80 : top,
        }}
      >
        <View
          className="py-3"
          style={{
            marginHorizontal: Platform.OS === 'web' ? 4 : 0,
          }}
        >
          <View className="gap-2">
            <View
              className="flex-row items-center"
              style={{
                paddingHorizontal: Platform.OS === 'web' ? 4 : 16,
                gap: 8,
                ...(Platform.OS === 'web'
                  ? { flexGrow: 1, justifyContent: 'center' }
                  : {}),
              }}
            >
              <Skeleton className="h-8 w-14 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </View>
            <View
              className="flex-row items-center"
              style={{
                paddingHorizontal: Platform.OS === 'web' ? 4 : 16,
                gap: 8,
                ...(Platform.OS === 'web'
                  ? { flexGrow: 1, justifyContent: 'center' }
                  : {}),
              }}
            >
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </View>
          </View>
        </View>

        <FlashList
          className="flex-1"
          contentContainerStyle={{
            padding: numColumns === 1 ? (Platform.OS === 'web' ? 4 : 16) : 8,
            paddingBottom: bottom,
          }}
          showsVerticalScrollIndicator={false}
          style={
            Platform.OS === 'web'
              ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
              : undefined
          }
          data={Array.from({ length: 6 })} // Show 6 skeleton items
          renderItem={() => (
            <View
              style={{
                flex: 1,
                margin: numColumns === 1 ? 0 : 6,
                marginBottom: numColumns === 1 ? 24 : 12,
              }}
            >
              <Card
                className={`w-full ${
                  numColumns === 1 ? 'web:max-w-4xl web:mx-auto' : ''
                }`}
              >
                {/* Header Skeleton */}
                <CardHeader className="flex-col gap-1 py-4">
                  <View className="flex-row items-start gap-3">
                    <View className="flex-col gap-1 flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </View>
                    <View className="flex-row gap-2">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <Skeleton className="w-12 h-12 rounded-lg" />
                    </View>
                  </View>

                  {/* Badges Skeleton */}
                  <View className="flex-row gap-2 mt-3">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </View>
                </CardHeader>

                {/* Content Skeleton */}
                <CardContent className="flex-col gap-2">
                  {/* Main Image Skeleton */}
                  <Skeleton className="w-full h-48 rounded-lg" />

                  {/* Summary Text Skeleton */}
                  <View className="space-y-2 mt-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </View>
                </CardContent>

                {/* Footer Skeleton */}
                <CardFooter>
                  <View className="flex-row justify-between items-center w-full">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="w-8 h-8 rounded" />
                  </View>
                </CardFooter>
              </Card>
            </View>
          )}
          keyExtractor={(_, index) => `skeleton-${index}`}
          numColumns={numColumns}
          ItemSeparatorComponent={() => <View />}
          ListFooterComponent={
            <View className="flex-row justify-center items-center py-8">
              <ActivityIndicator size="small" color="#888" />
              <Text className="ml-2 text-gray-500 dark:text-gray-400">
                Loading contests...
              </Text>
            </View>
          }
        />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-black bg-white">
        <Text className="text-red-500">{error}</Text>
      </View>
    )
  }

  if (contests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-black bg-white">
        <Text className="text-black dark:text-white">{t`No contests found.`}</Text>
      </View>
    )
  }

  const renderItem = ({ item: contest }: { item: Contest }) => {
    // For anonymous users, contest is actually EnrichedPublicContest with embedded hosts/categories
    // For authenticated users, contest is Contest with host_ids/category_ids
    let contestHosts: Host[]
    let badgeCategories: ContestBadgeCategory[]

    if (!user) {
      // Anonymous: use embedded hosts and categories from public contest
      const publicContest = contest as any
      contestHosts = (publicContest.hosts || []).map((h: any) => ({
        $id: h.$id,
        name: h.name,
        slug: h.slug,
        img_id: h.img_id,
        img_token_secret: h.img_token_secret,
        img_blurhash: h.img_blurhash,
      })) as Host[]

      badgeCategories = (publicContest.categories || []).map(
        (cat: any, index: number) => ({
          id: cat.$id,
          name_en: cat.name_en,
          name_ms: cat.name_ms,
          priority_order: cat.priority_order ?? null,
          originalIndex: index,
          type: cat.type ?? null,
        }),
      )
    } else {
      // Authenticated: look up by IDs
      contestHosts = (contest.host_ids || [])
        .map((id) => hostsById.get(id))
        .filter(Boolean) as Host[]

      badgeCategories = []
      ;(contest.category_ids || []).forEach((id, index) => {
        const category = categoriesById.get(id)
        if (!category) return

        badgeCategories.push({
          id: category.$id,
          name_en: category.name_en,
          name_ms: category.name_ms,
          priority_order: category.priority_order ?? null,
          originalIndex: index,
          type: category.type ?? null,
        })
      })
    }

    // Get receipt count for this contest
    const receiptCount = receiptCounts[contest.$id] || 0

    // Get upvote count from public contests data for anonymous users
    // For anonymous users, contest IS the public contest with upvote_count directly on it
    const initialUpvoteCount = !user
      ? (contest as any).upvote_count || 0
      : undefined

    return (
      <ContestCard
        contest={contest}
        hosts={contestHosts}
        badgeCategories={badgeCategories}
        language={language}
        jwt={jwt}
        onPress={() => {
          if (contest.slug) navigateToContest(contest.slug as string)
        }}
        numColumns={numColumns}
        receiptCount={receiptCount}
        onManageReceipts={() => {
          setSelectedContestForReceipt(contest)
          setReceiptModalVisible(true)
        }}
        initialUpvoteCount={initialUpvoteCount}
      />
    )
  }

  return (
    <>
      <View
        className="flex-1 dark:bg-black bg-white"
        style={{
          paddingTop: hideTopPadding ? 0 : Platform.OS === 'web' ? 80 : top, // 80px for web to account for navbar, safe area top for native
        }}
      >
        {/* Category Filter - placed outside FlashList so it's always visible */}
        {availableFilterCategories.length > 0 && (
          <View
            className="py-3"
            style={{
              marginHorizontal: Platform.OS === 'web' ? 4 : 0,
            }}
          >
            <CategoryFilter
              categories={availableFilterCategories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleCategorySelect}
              language={language}
            />
          </View>
        )}

        <FlashList
          className="flex-1"
          contentContainerStyle={{
            padding: numColumns === 1 ? (Platform.OS === 'web' ? 4 : 16) : 8,
            paddingBottom: bottom, // Keep bottom padding for native safe area
          }}
          showsVerticalScrollIndicator={false}
          style={
            Platform.OS === 'web'
              ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
              : undefined
          }
          data={contests}
          renderItem={renderItem}
          keyExtractor={(item: Contest) => {
            // Improved keyExtractor to prevent missing items (similar to search screen)
            // Prefer stable unique ids; fall back to slug combined with dates or title
            if (item.$id) return item.$id
            const slugOrTitle = item.slug || item.title || 'contest'
            const start = item.start_date || ''
            const end = item.end_date || ''
            return `${slugOrTitle}-${start}-${end}`
          }}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => <View />}
          numColumns={numColumns}
          ListHeaderComponent={
            <View>
              {/* Sign-in prompt for anonymous users */}
              {!user && allContests.length > 0 && (
                <View
                  className={`mb-4 p-4 rounded-lg ${
                    isDarkColorScheme ? 'bg-blue-950' : 'bg-blue-50'
                  }`}
                  style={{
                    marginHorizontal: numColumns === 1 ? 0 : 6,
                  }}
                >
                  <Text
                    className={`text-center font-medium mb-2 ${
                      isDarkColorScheme ? 'text-blue-200' : 'text-blue-800'
                    }`}
                  >
                    <Trans>Sign in to see all contests and participate!</Trans>
                  </Text>
                  <View className="items-center">
                    <Button
                      onPress={() =>
                        router.push('/sign-in-register?redirect=/')
                      }
                      size="sm"
                      className="mt-1"
                    >
                      <Text>
                        <Trans>Sign In / Register</Trans>
                      </Text>
                    </Button>
                  </View>
                </View>
              )}

              {/* No results message when filtering - only show after all pages are loaded */}
              {selectedCategoryId &&
                contests.length === 0 &&
                allContests.length > 0 &&
                !isFetchingNextPage &&
                !hasNextPage && (
                  <View
                    className={`p-4 rounded-lg ${
                      isDarkColorScheme ? 'bg-gray-900' : 'bg-gray-100'
                    }`}
                    style={{
                      marginHorizontal: numColumns === 1 ? 0 : 6,
                    }}
                  >
                    <Text
                      className={`text-center ${
                        isDarkColorScheme ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      <Trans>No contests found in this category.</Trans>
                    </Text>
                  </View>
                )}
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="large" color="#888" />
              </View>
            ) : !user && allContests.length > 0 ? (
              <View
                className={`mt-4 p-4 rounded-lg ${
                  isDarkColorScheme ? 'bg-gray-900' : 'bg-gray-100'
                }`}
                style={{
                  marginHorizontal: numColumns === 1 ? 0 : 6,
                }}
              >
                <Text
                  className={`text-center ${
                    isDarkColorScheme ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <Trans>Want to see more contests?</Trans>{' '}
                  <Pressable
                    onPress={() => router.push('/sign-in-register?redirect=/')}
                  >
                    <Text
                      className={`underline ${
                        Platform.OS === 'web' ? 'text-main' : ''
                      }`}
                      style={
                        Platform.OS !== 'web' ? { color: main } : undefined
                      }
                    >
                      <Trans>Sign in or Register</Trans>
                    </Text>
                  </Pressable>{' '}
                  <Trans>to access the full list!</Trans>
                </Text>
              </View>
            ) : null
          }
        />
      </View>
      {/* Receipt Manager Modal */}
      {selectedContestForReceipt && (
        <ReceiptManagerModal
          visible={receiptModalVisible}
          contestId={selectedContestForReceipt.$id}
          contestTitle={
            language === 'ms' && selectedContestForReceipt.title_ms
              ? selectedContestForReceipt.title_ms
              : selectedContestForReceipt.title
          }
          onClose={() => {
            setReceiptModalVisible(false)
            setSelectedContestForReceipt(null)
          }}
        />
      )}
    </>
  )
}

/*
  NOTES:

  On Android the request that the React Native Image component makes is missing the Appwrite session-cookie / JWT that is needed to access a private file.

  Why only Android?

  - iOS/web – the networking stack that loads the <Image/> shares the same cookie-jar that appwrite.account.createSession() writes to, so the request automatically carries a_session_<projectId>=….
  Server authenticates → 200 → image shows.

  - Android – Image is handled by Fresco. Fresco spins up its own HTTP client (OkHttp) that is not wired to React Native's cookie / header store, so the cookie never goes out. 
  Appwrite therefore answers 404 (or 401/403) and Fresco renders nothing – you only see a blank rectangle. The same URL therefore works in the browser and on iOS but fails on Android.

  That is why a completely public JPG (picsum) loads everywhere, while the Appwrite …/view URL only loads on platforms that send the auth cookie.

*/
