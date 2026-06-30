import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ActivityIndicator,
  View,
  Platform,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { cn } from 'app/lib/utils'
import Colors from 'app/utils/constants/ConstColors'
import { useLingui, Trans } from '@lingui/react/macro'
import { Query, Models } from 'app/lib/appwrite-universal'
import { tablesDB, account } from 'app/provider/appwrite/api'
import { useQuery } from '@tanstack/react-query'
import { BACKEND } from 'app/lib/backend'
import { getUserPrefs } from 'app/lib/prefs'

import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from 'app/components/ui/card'
import { Skeleton } from 'app/components/ui/skeleton'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'
import { useRouter } from 'app/lib/router-universal'
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
import { useAuth } from 'app/contexts/AuthContext'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { useUserSavedContests } from 'app/hooks/useSave'
import { useContestNavigation } from 'app/hooks/useContestNavigation'
import { ContestCard } from 'app/features/contest/components/ContestCard'
import { EngagementProvider } from 'app/contexts/EngagementContext'
import { toast } from 'app/lib/sonner-universal'
import ReceiptManagerModal from 'app/features/profile/components/ReceiptManagerModal'
import {
  DATABASE_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_CATEGORIES_COLLECTION_ID,
} from 'app/provider/appwrite/constants'
import { type ContestBadgeCategory } from 'app/features/contest/components/ContestBadges'

// Type definitions
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
  savedAt?: string // Timestamp when the contest was saved
}

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

function SavedTabContent() {
  const { t } = useLingui()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isDarkColorScheme } = useColorScheme()
  const { user } = useAuth()
  const { colorTheme } = useColorTheme()
  const { navigateToContest } = useContestNavigation({ baseUrl: '/profile' })

  // Helper function to get theme-aware text classes for the "Uploaded" pill
  const getUploadedTextClass = () => {
    if (Platform.OS === 'web') {
      return 'text-main'
    }
    // On native, use hardcoded color classes based on colorTheme
    if (colorTheme === 'blue') return 'text-blue-500'
    if (colorTheme === 'purple') return 'text-purple-500'
    return 'text-green-600'
  }

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserSavedContests()

  const [refreshing, setRefreshing] = useState(false)
  const [jwt, setJwt] = useState<string | null>(null)
  const [hasShownInitialData, setHasShownInitialData] = useState(false)

  // Segmented control state
  const [savedView, setSavedView] = useState<'active' | 'uploaded' | 'expired'>(
    'uploaded'
  )

  // Receipt modal state
  const [receiptModalVisible, setReceiptModalVisible] = useState(false)
  const [selectedContestForReceipt, setSelectedContestForReceipt] =
    useState<Contest | null>(null)

  // Unsave confirmation dialog state
  const [unsaveDialogOpen, setUnsaveDialogOpen] = useState(false)
  const [contestToUnsave, setContestToUnsave] = useState<Contest | null>(null)
  const [isUnsaveLoading, setIsUnsaveLoading] = useState(false)

  // Handle unsave confirmation
  const handleUnsaveConfirm = async () => {
    if (!contestToUnsave || !user?.$id) return

    const contestId = contestToUnsave.$id
    const userId = user.$id
    const receiptCount = getReceiptCount(contestId)

    // Close dialog immediately for better UX
    setUnsaveDialogOpen(false)
    setIsUnsaveLoading(true)

    // OPTIMISTIC UPDATE: Update save status immediately
    queryClient.setQueryData(['save', 'status', contestId, userId], false)

    // OPTIMISTIC UPDATE: Remove from saved contests list
    queryClient.setQueryData(['saves', 'user', userId], (oldData: any) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        pages: oldData.pages.map((page: Contest[]) =>
          page.filter((contest) => contest.$id !== contestId)
        ),
      }
    })

    // Show immediate feedback
    toast.success(t`Contest unsaved`)

    try {
      // Archive receipts first if any exist (moves files to the archive bucket).
      if (receiptCount > 0) {
        if (BACKEND === 'supabase') {
          const { archiveContestReceiptsSupabase } = await import(
            'app/lib/supabase'
          )
          await archiveContestReceiptsSupabase(
            contestId,
            'Contest unsaved by user'
          )
        } else {
          const { archiveContestReceipts } = await import(
            'app/lib/receipts/api'
          )
          await archiveContestReceipts(
            userId,
            contestId,
            'Contest unsaved by user'
          )
        }
      }

      // Perform actual API call in background
      if (BACKEND === 'supabase') {
        const { removeSaveSupabase } = await import('app/lib/supabase')
        await removeSaveSupabase(contestId)
      } else {
        const { removeSave: removeSaveAPI } = await import('app/lib/saves/api')
        await removeSaveAPI(contestId, userId)
      }

      // Invalidate queries to ensure data is fresh
      queryClient.invalidateQueries({
        queryKey: ['save', 'status', contestId, userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['saves', 'user', userId],
      })
    } catch (error) {
      console.error('Failed to unsave contest:', error)

      // ROLLBACK: Restore the contest on error
      queryClient.invalidateQueries({
        queryKey: ['save', 'status', contestId, userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['saves', 'user', userId],
      })

      toast.error(t`Failed to unsave contest. Please try again.`)
    } finally {
      setIsUnsaveLoading(false)
      setContestToUnsave(null)
    }
  }

  // Handle save status change (called from ContestCard)
  const handleSaveChange = (contest: Contest, isSaved: boolean) => {
    // isSaved represents the CURRENT state (before the action)
    // If isSaved is true, user is trying to unsave - show confirmation dialog
    if (isSaved) {
      setContestToUnsave(contest)
      setUnsaveDialogOpen(true)
    }
  }

  // Flatten all pages into a single array
  const savedContests = (data?.pages.flat() || []) as Contest[]

  // Track when we've shown data at least once
  useEffect(() => {
    if (savedContests.length > 0 || (!isLoading && !isFetching)) {
      setHasShownInitialData(true)
    }
  }, [savedContests.length, isLoading, isFetching])

  // Reset the flag when component mounts to ensure skeleton shows on fresh navigation
  useEffect(() => {
    setHasShownInitialData(false)
    // Trigger a refetch when the tab content mounts
    refetch()
  }, [])

  // Fetch all host docs referenced by contests (batch)
  const allHostIds = savedContests
    .flatMap((c) => c.host_ids || [])
    .filter((id, index, self) => self.indexOf(id) === index)

  const { data: allHosts = [] } = useQuery<Host[]>({
    queryKey: ['contest-hosts', allHostIds.sort().join(',')],
    enabled: allHostIds.length > 0,
    queryFn: async () => {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTEST_HOSTS_COLLECTION_ID,
        queries: [Query.equal('$id', allHostIds), Query.limit(100)],
      })
      return res.rows as unknown as Host[]
    },
  })

  const hostsById = new Map<string, Host>()
  allHosts.forEach((h) => hostsById.set(h.$id, h))

  // Fetch all categories referenced by contests (batch)
  const allCategoryIds = savedContests
    .flatMap((c) => c.category_ids || [])
    .filter((id, index, self) => self.indexOf(id) === index)

  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ['contest-categories', allCategoryIds.sort().join(',')],
    enabled: allCategoryIds.length > 0,
    queryFn: async () => {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTEST_CATEGORIES_COLLECTION_ID,
        queries: [Query.equal('$id', allCategoryIds), Query.limit(200)],
      })
      return res.rows as unknown as Category[]
    },
  })

  const categoriesById = new Map<string, Category>()
  allCategories.forEach((c) => categoriesById.set(c.$id, c))

  // Language preference
  const { data: language = 'en' } = useQuery<'en' | 'ms'>({
    queryKey: ['user-language-preference'],
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Receipt stats for filtering
  const { data: receiptStats } = useQuery<{
    totalContestsWithReceipts: number
    contestsWithReceipts: string[]
  }>({
    queryKey: ['receipts', 'stats', user?.$id],
    queryFn: async () => {
      if (!user?.$id) throw new Error('User not authenticated')
      if (BACKEND === 'supabase') {
        const { getUserReceiptStatsSupabase } = await import('app/lib/supabase')
        return getUserReceiptStatsSupabase()
      }
      const { getUserReceiptStats } = await import('app/lib/receipts/api')
      return getUserReceiptStats(user.$id)
    },
    enabled: !!user?.$id,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Receipt counts for all contests with receipts
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
      const getCount =
        BACKEND === 'supabase'
          ? async (contestId: string) => {
              const { getContestReceiptCountSupabase } = await import(
                'app/lib/supabase'
              )
              return getContestReceiptCountSupabase(contestId)
            }
          : async (contestId: string) => {
              const { getContestReceiptCount } = await import(
                'app/lib/receipts/api'
              )
              return getContestReceiptCount(user.$id, contestId)
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
              error
            )
            counts[contestId] = 0
          }
        })
      )

      return counts
    },
    enabled: !!user?.$id && !!receiptStats?.contestsWithReceipts.length,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Get receipt count per contest
  const getReceiptCount = (contestId: string): number => {
    return receiptCounts[contestId] || 0
  }

  // Handle receipt button press
  const handleReceiptPress = (contest: Contest) => {
    setSelectedContestForReceipt(contest)
    setReceiptModalVisible(true)
  }

  // Handle receipt modal close
  const handleReceiptModalClose = () => {
    setReceiptModalVisible(false)
    setSelectedContestForReceipt(null)
  }

  // Android JWT for images (Appwrite private-image auth only).
  if (Platform.OS === 'android') {
    useEffect(() => {
      if (BACKEND !== 'appwrite') return
      const fetchJWT = async () => {
        const { jwt } = await account.createJWT()
        setJwt(jwt)
      }
      fetchJWT()
    }, [])
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  // Check if we're loading hosts or categories (only show if we have contests)
  const isLoadingRelatedData =
    savedContests.length > 0 &&
    ((allHostIds.length > 0 && allHosts.length === 0) ||
      (allCategoryIds.length > 0 && allCategories.length === 0))

  // Show skeleton loaders if:
  // 1. Initial loading (isLoading = true)
  // 2. Fetching but haven't shown data yet (prevents flash of cached data)
  // 3. No data available yet and no error
  const shouldShowSkeleton =
    (isLoading || (isFetching && !hasShownInitialData)) && !error

  // Loading state - show skeleton loaders
  if (shouldShowSkeleton) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: Platform.OS === 'web' ? 4 : 16,
        }}
      >
        {/* Upload Pills Skeleton */}
        <View className="flex-row items-center gap-2 mb-4">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </View>

        <View className="gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`skeleton-${index}`}
              className="w-full web:max-w-5xl web:mx-auto"
            >
              {/* Header Skeleton */}
              <CardHeader className="flex-col gap-1 py-4">
                <View className="flex-col gap-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <View className="flex-row items-start gap-3">
                    <View className="flex-col gap-1 flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <Skeleton className="w-12 h-12 rounded" />
                    </View>
                  </View>
                </View>
                {/* Badges Skeleton */}
                <View className="flex-row gap-2 mt-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </View>
              </CardHeader>

              {/* Content Skeleton */}
              <CardContent className="flex-col gap-2">
                <Skeleton className="w-full h-48 rounded-lg" />
                <View className="space-y-2 mt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </View>
              </CardContent>

              {/* Footer Skeleton */}
              <CardFooter>
                <View className="flex-row justify-between items-center w-full">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-8" />
                </View>
              </CardFooter>
            </Card>
          ))}
        </View>
      </ScrollView>
    )
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-red-500 text-center">
          <Trans>Failed to load saved contests</Trans>
        </Text>
        <Button onPress={() => refetch()} variant="outline" className="mt-4">
          <Text>
            <Trans>Try Again</Trans>
          </Text>
        </Button>
      </View>
    )
  }

  // Empty state
  if (savedContests.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8 gap-4">
        <BookmarkSolidIcon
          className="w-16 h-16 text-gray-400 dark:text-gray-600"
          accessibilityLabel="No saved contests"
        />
        <Text className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center">
          <Trans>No Saved Contests Yet</Trans>
        </Text>
        <Text className="text-gray-600 dark:text-gray-400 text-center">
          <Trans>Start saving contests to build your collection</Trans>
        </Text>
        <Button
          onPress={() => router.push('/')}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Text className="text-white font-medium">
            <Trans>Browse Contests</Trans>
          </Text>
        </Button>
      </View>
    )
  }

  // Check if we're updating (refetching or loading related data)
  const isUpdating = (isFetching && !isLoading) || isLoadingRelatedData

  // Calculate counts for each category
  const contestCounts = savedContests.reduce(
    (counts, contest) => {
      const now = new Date()
      const endDate = new Date(contest.end_date)
      const isExpired = endDate < now
      const hasReceipts =
        receiptStats?.contestsWithReceipts.includes(contest.$id) || false

      if (!isExpired) counts.active++
      if (isExpired) counts.expired++
      if (hasReceipts) counts.uploaded++

      return counts
    },
    { active: 0, uploaded: 0, expired: 0 }
  )

  // Filter contests based on selected view
  const filteredContests = savedContests.filter((contest) => {
    const now = new Date()
    const endDate = new Date(contest.end_date)
    const isExpired = endDate < now
    const hasReceipts =
      receiptStats?.contestsWithReceipts.includes(contest.$id) || false

    if (savedView === 'active') {
      return !isExpired
    } else if (savedView === 'expired') {
      return isExpired
    } else if (savedView === 'uploaded') {
      return hasReceipts
    }
    return true
  })

  // Contests list
  return (
    <EngagementProvider
      contests={savedContests as { $id: string; upvote_count?: number }[]}
    >
    <View className="flex-1 relative">
      {/* Loading overlay - centered in middle of screen */}
      {isUpdating && (
        <View className="absolute top-0 left-0 right-0 bottom-0 z-50 flex-row justify-center items-center pointer-events-none">
          <View className="bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-3 flex-row items-center gap-2 border border-gray-200 dark:border-gray-700">
            <ActivityIndicator
              size="small"
              color={isDarkColorScheme ? Colors.dark.tint : Colors.light.tint}
            />
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <Trans>Updating...</Trans>
            </Text>
          </View>
        </View>
      )}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: Platform.OS === 'web' ? 4 : 16,
          paddingTop: Platform.OS === 'web' ? 4 : 16,
          paddingBottom: Platform.OS === 'web' ? 4 : 16,
        }}
        showsVerticalScrollIndicator={false}
        style={
          Platform.OS === 'web'
            ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
            : undefined
        }
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        onScroll={({ nativeEvent }) => {
          // Infinite scroll for web
          if (Platform.OS === 'web') {
            const { layoutMeasurement, contentOffset, contentSize } =
              nativeEvent
            const paddingToBottom = 20
            if (
              layoutMeasurement.height + contentOffset.y >=
              contentSize.height - paddingToBottom
            ) {
              handleLoadMore()
            }
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Individual Boxy Pill Buttons - Horizontally Scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          className="mb-4"
          style={Platform.OS === 'web' ? { overflow: 'hidden' } : undefined}
        >
          <Pressable
            onPress={() => setSavedView('uploaded')}
            className={cn(
              'flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 shadow-none shadow-black/5',
              savedView === 'uploaded'
                ? 'bg-background dark:border-foreground/10 dark:bg-input/30'
                : 'bg-muted border-border'
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium whitespace-nowrap',
                savedView === 'uploaded'
                  ? getUploadedTextClass()
                  : 'text-foreground/70 dark:text-muted-foreground'
              )}
            >
              <Trans>Uploaded</Trans> ({contestCounts.uploaded})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSavedView('active')}
            className={cn(
              'flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 shadow-none shadow-black/5',
              savedView === 'active'
                ? 'bg-background dark:border-foreground/10 dark:bg-input/30'
                : 'bg-muted border-border'
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium whitespace-nowrap',
                savedView === 'active'
                  ? 'text-foreground dark:text-foreground'
                  : 'text-foreground/70 dark:text-muted-foreground'
              )}
            >
              <Trans>Active</Trans> ({contestCounts.active})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSavedView('expired')}
            className={cn(
              'flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 shadow-none shadow-black/5',
              savedView === 'expired'
                ? 'bg-background dark:border-foreground/10 dark:bg-input/30'
                : 'bg-muted border-border'
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium whitespace-nowrap',
                savedView === 'expired'
                  ? 'text-foreground dark:text-foreground'
                  : 'text-foreground/70 dark:text-muted-foreground'
              )}
            >
              <Trans>Ended</Trans> ({contestCounts.expired})
            </Text>
          </Pressable>
        </ScrollView>

        <View className="gap-4">
          {filteredContests.map((contest: Contest) => {
            // Supabase saved contests carry embedded hosts/categories; the
            // Appwrite path resolves them from host_ids/category_ids batches.
            const embeddedHosts = (contest as any).hosts as Host[] | undefined
            const contestHosts =
              embeddedHosts && embeddedHosts.length > 0
                ? embeddedHosts
                : ((contest.host_ids || [])
                    .map((id) => hostsById.get(id))
                    .filter(Boolean) as Host[])

            const embeddedCategories = (contest as any).categories as
              | Array<{
                  $id: string
                  name_en: string
                  name_ms: string
                  priority_order?: number | null
                  type?: ContestBadgeCategory['type']
                }>
              | undefined

            const badgeCategories: ContestBadgeCategory[] = []
            if (embeddedCategories && embeddedCategories.length > 0) {
              embeddedCategories.forEach((category, index) => {
                badgeCategories.push({
                  id: category.$id,
                  name_en: category.name_en,
                  name_ms: category.name_ms,
                  priority_order: category.priority_order ?? null,
                  originalIndex: index,
                  type: category.type ?? null,
                })
              })
            } else {
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

            return (
              <View
                key={contest.$id}
                className="w-full web:max-w-4xl web:mx-auto"
              >
                <ContestCard
                  contest={contest}
                  hosts={contestHosts}
                  badgeCategories={badgeCategories}
                  language={language}
                  jwt={jwt}
                  onPress={() => {
                    if (contest.slug) navigateToContest(contest.slug)
                  }}
                  showSavedIndicator={true}
                  onSaveChange={(isSaved) => handleSaveChange(contest, isSaved)}
                  showReceiptButton={true}
                  receiptCount={getReceiptCount(contest.$id)}
                  onReceiptPress={() => handleReceiptPress(contest)}
                />
              </View>
            )
          })}

          {/* Load more indicator */}
          {isFetchingNextPage && (
            <View className="py-4 items-center">
              <ActivityIndicator
                size="small"
                color={isDarkColorScheme ? Colors.dark.tint : Colors.light.tint}
              />
            </View>
          )}

          {/* No results for filter */}
          {filteredContests.length === 0 && savedContests.length > 0 && (
            <View className="py-12 items-center">
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                {savedView === 'active' && <Trans>No Active Contests</Trans>}
                {savedView === 'uploaded' && (
                  <Trans>No Contests with Receipts</Trans>
                )}
                {savedView === 'expired' && <Trans>No Ended Contests</Trans>}
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {savedView === 'active' && (
                  <Trans>All your saved contests have expired</Trans>
                )}
                {savedView === 'uploaded' && (
                  <Trans>Upload receipts to see them here</Trans>
                )}
                {savedView === 'expired' && (
                  <Trans>Your saved contests are still active</Trans>
                )}
              </Text>
            </View>
          )}

          {/* End of list message */}
          {!hasNextPage && filteredContests.length > 0 && (
            <View className="py-4 items-center">
              <Text className="text-gray-500 dark:text-gray-400 text-sm">
                <Trans>You've reached the end</Trans>
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Unsave Confirmation Dialog */}
      <AlertDialog open={unsaveDialogOpen} onOpenChange={setUnsaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Unsave Contest?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {contestToUnsave && getReceiptCount(contestToUnsave.$id) > 0 ? (
                <Trans>
                  You have uploaded receipt(s) for "{contestToUnsave?.title}".
                  Your receipts will be removed from your profile. Are you sure
                  you want to proceed?
                </Trans>
              ) : (
                <Trans>
                  Are you sure you want to remove "{contestToUnsave?.title}"
                  from your saved contests? You can always save it again later.
                </Trans>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPress={() => {
                setUnsaveDialogOpen(false)
                setContestToUnsave(null)
              }}
              disabled={isUnsaveLoading}
            >
              <Text>
                <Trans>Cancel</Trans>
              </Text>
            </AlertDialogCancel>

            {/* Manage Receipts Button */}
            <Button
              onPress={() => {
                if (contestToUnsave) {
                  setUnsaveDialogOpen(false)
                  handleReceiptPress(contestToUnsave)
                }
              }}
              variant="outline"
              className="border-blue-500"
              disabled={isUnsaveLoading}
            >
              <Text className="text-blue-500">
                <Trans>Manage Receipts</Trans>
              </Text>
            </Button>

            <AlertDialogAction
              onPress={handleUnsaveConfirm}
              disabled={isUnsaveLoading}
              className="bg-red-500"
            >
              {isUnsaveLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white">
                    <Trans>Unsaving...</Trans>
                  </Text>
                </View>
              ) : (
                <Text className="text-white">
                  <Trans>Confirm Unsave</Trans>
                </Text>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          onClose={handleReceiptModalClose}
        />
      )}
    </View>
    </EngagementProvider>
  )
}

export default SavedTabContent
