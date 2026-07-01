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
import type { Document } from 'app/lib/types'
import { Trans, useLingui } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'app/components/ui/card'
import { Button } from 'app/components/ui/button'
import { useAuth } from 'app/contexts/AuthContext'
import { useRouter } from 'app/lib/router-universal'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useIsAdmin } from 'app/hooks/useIsAdmin'

import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useContestNavigation } from 'app/hooks/useContestNavigation'
import { type ContestBadgeCategory } from 'app/features/contest/components/ContestBadges'
import { ContestCard } from 'app/features/contest/components/ContestCard'
import { EngagementProvider } from 'app/contexts/EngagementContext'
import { Skeleton } from 'app/components/ui/skeleton'
import { useReceiptStats } from 'app/hooks/useReceipts'
import ReceiptManagerModal from 'app/features/profile/components/ReceiptManagerModal'
import { fetchPublicContestsSupabase } from 'app/lib/supabase/contests'
import { getUserPrefs } from 'app/lib/prefs'
import {
  CategoryFilter,
  type FilterCategory,
} from 'app/components/CategoryFilter'

// Constants for pagination
const CONTESTS_PER_PAGE = 50

// Authentication required message component

// Define types for contests and contest files
type Contest = Document & {
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

  // CONTESTS LIST (Supabase, offset-paginated). Admins additionally see hidden
  // (visibility='admin') contests; RLS enforces that gate for everyone else.
  // Anonymous users still get the first page but are prompted to sign in for
  // more (onEndReached only paginates when a user is signed in).
  const {
    data: contestsData,
    isLoading: isLoadingContests,
    isError: isErrorContests,
    refetch: refetchContests,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['contests', 'supabase', isAdmin],
    enabled: !isLoadingUser && !isLoadingAdmin,
    initialPageParam: 0 as number,
    queryFn: async ({ pageParam }) => {
      const rows = await fetchPublicContestsSupabase(
        CONTESTS_PER_PAGE,
        pageParam as number,
        isAdmin,
      )
      return rows as unknown as Contest[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === CONTESTS_PER_PAGE
        ? allPages.length * CONTESTS_PER_PAGE
        : undefined,
  })

  // Flatten paginated data into a single array
  const allContests = useMemo(
    () => (contestsData?.pages.flat() ?? []) as Contest[],
    [contestsData],
  )

  // Filter-bar categories: derived from the loaded contests' embedded
  // categories (prize + winner_selection only), de-duplicated.
  const filterCategories = useMemo<FilterCategory[]>(() => {
    const map = new Map<string, FilterCategory>()
    allContests.forEach((contest: any) => {
      ;(contest.categories || []).forEach((cat: any) => {
        if (
          (cat.type === 'prize' || cat.type === 'winner_selection') &&
          !map.has(cat.$id)
        ) {
          map.set(cat.$id, {
            $id: cat.$id,
            name_en: cat.name_en,
            name_ms: cat.name_ms,
            slug: cat.slug,
            priority_order: cat.priority_order,
            type: cat.type,
          })
        }
      })
    })
    return Array.from(map.values())
  }, [allContests])

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

      const counts: Record<string, number> = {}
      const getCount = async (contestId: string) => {
        const { getContestReceiptCountSupabase } = await import(
          'app/lib/supabase'
        )
        return getContestReceiptCountSupabase(contestId)
      }

      // Fetch counts for all contests with receipts
      await Promise.all(
        receiptStats.contestsWithReceipts.map(async (contestId) => {
          try {
            const count = await getCount(contestId)
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

  const [receiptModalVisible, setReceiptModalVisible] = useState(false)
  const [selectedContestForReceipt, setSelectedContestForReceipt] =
    useState<Contest | null>(null)

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
    // Supabase contests carry embedded hosts/categories.
    const publicContest = contest as any
    const contestHosts = (publicContest.hosts || []).map((h: any) => ({
      $id: h.$id,
      name: h.name,
      slug: h.slug,
      img_id: h.img_id,
      img_token_secret: h.img_token_secret,
      img_blurhash: h.img_blurhash,
    })) as Host[]

    const badgeCategories: ContestBadgeCategory[] = (
      publicContest.categories || []
    ).map((cat: any, index: number) => ({
      id: cat.$id,
      name_en: cat.name_en,
      name_ms: cat.name_ms,
      priority_order: cat.priority_order ?? null,
      originalIndex: index,
      type: cat.type ?? null,
    }))

    const receiptCount = receiptCounts[contest.$id] || 0
    const initialUpvoteCount = (contest as any).upvote_count || 0

    return (
      <ContestCard
        contest={contest}
        hosts={contestHosts}
        badgeCategories={badgeCategories}
        language={language}
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
    <EngagementProvider
      contests={allContests as { $id: string; upvote_count?: number }[]}
    >
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
    </EngagementProvider>
  )
}
