import { useRef, useState, useEffect, useCallback } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context'
const SafeAreaView =
  Platform.OS === 'web' ? View : (RNSafeAreaView as unknown as typeof View)
import { FlashList } from '@shopify/flash-list'
import { Image as ExpoImage } from 'expo-image'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime)

import { Trans, useLingui } from '@lingui/react/macro'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Badge } from 'app/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'app/components/ui/card'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useContestNavigation } from 'app/hooks/useContestNavigation'
import { FunnelOutline } from 'app/components/icons-svg/FunnelOutline'
import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { account, functions } from 'app/provider/appwrite/api'
import { useAuth } from 'app/contexts/AuthContext'
import { useRouter } from 'app/lib/router-universal'
import { useQuery } from '@tanstack/react-query'

// ===== SEARCH CONFIGURATION =====
/**
 * EASY TOGGLE: Switch between search implementations
 *
 * false = Use Appwrite Function (current - slower but more secure)
 * true  = Use Direct Meilisearch API (faster but exposes search key)
 *
 * When switching to Direct Meilisearch (true):
 * 1. Update MEILISEARCH_CONFIG below with your credentials
 * 2. Ensure you're using a search-only API key
 * 3. Consider hosting behind Cloudflare for protection
 */
const USE_DIRECT_MEILISEARCH = true // Set to true to use direct Meilisearch API

// Direct Meilisearch configuration (only used if USE_DIRECT_MEILISEARCH = true)
const MEILISEARCH_CONFIG = {
  host: 'https://edge.meilisearch.com', // Replace with your Meilisearch host
  searchApiKey:
    '2d2fe8ed30c0af4552c7e73430fcd137b6276fe68e524ea36f1807322d384cbe', // Replace with your search-only API key
  indexName: 'contests',
}

// Appwrite function configuration (only used if USE_DIRECT_MEILISEARCH = false)
const APPWRITE_FUNCTION_ID = '68c0fb9d00000f1ab95c'

// ===== SEARCH TYPES =====
export interface SearchParams {
  query?: string
  filters?: Record<string, any>
  sort?: string[]
  limit?: number
  offset?: number
  attributesToRetrieve?: string[]
  attributesToHighlight?: string[]
  facets?: string[]
}

export interface SearchResult {
  hits: any[]
  query: string
  processingTimeMs: number
  limit: number
  offset: number
  estimatedTotalHits: number
  facetDistribution?: Record<string, any>
}

// ===== SEARCH IMPLEMENTATIONS =====
/**
 * Search using Appwrite Function (current implementation)
 */
async function searchViaAppwriteFunction(
  params: SearchParams = {},
): Promise<SearchResult> {
  try {
    const startTime = Date.now()
    console.log('🔄 Searching via Appwrite Function...')

    const execution = await functions.createExecution(
      APPWRITE_FUNCTION_ID,
      JSON.stringify(params),
    )

    const responseBody =
      (execution as any).responseBody ??
      (execution as any).response ??
      execution

    const result =
      typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody

    const endTime = Date.now()
    console.log(
      `✅ Appwrite Function search completed in ${endTime - startTime}ms`,
    )

    return result
  } catch (error) {
    console.warn('❌ Error searching via Appwrite Function:', error)
    throw error
  }
}

/**
 * Search using direct Meilisearch API
 */
async function searchViaDirectMeilisearch(
  params: SearchParams = {},
): Promise<SearchResult> {
  try {
    const startTime = Date.now()
    // console.log('🚀 Searching via Direct Meilisearch...')

    const {
      query = '',
      filters = {},
      sort = [],
      limit = 20,
      offset = 0,
      attributesToRetrieve = ['*'],
      attributesToHighlight = [
        'title',
        'title_ms',
        'summary',
        'summary_ms',
        'host_names',
        'category_names_en',
        'category_names_ms',
      ],
      facets = [],
    } = params

    // Build search parameters for Meilisearch
    const searchParams: any = {
      limit,
      offset,
      attributesToRetrieve,
      attributesToHighlight,
    }

    // Add facets if provided
    if (facets && facets.length > 0) {
      searchParams.facets = facets
    }

    // Add filters if provided
    if (Object.keys(filters).length > 0) {
      const filterStrings: string[] = []

      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          // Handle array filters (e.g., status IN ['active', 'upcoming'])
          const valueStrings = value.map((v: any) => `"${v}"`).join(', ')
          filterStrings.push(`${key} IN [${valueStrings}]`)
        } else {
          // Handle single value filters
          filterStrings.push(`${key} = "${value}"`)
        }
      }

      searchParams.filter = filterStrings
    }

    // Add sorting if provided
    if (sort.length > 0) {
      searchParams.sort = sort
    }

    // Make direct HTTP request to Meilisearch
    const searchUrl = `${MEILISEARCH_CONFIG.host}/indexes/${MEILISEARCH_CONFIG.indexName}/search`

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MEILISEARCH_CONFIG.searchApiKey}`,
      },
      body: JSON.stringify({
        q: query,
        ...searchParams,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Meilisearch API error: ${response.status} ${response.statusText}`,
      )
    }

    const searchResults = await response.json()

    const endTime = Date.now()
    console.log(
      `🚀 Direct Meilisearch search completed in ${endTime - startTime}ms`,
    )

    // Return results in consistent format
    return {
      hits: searchResults.hits,
      query: searchResults.query,
      processingTimeMs: searchResults.processingTimeMs,
      limit: searchResults.limit,
      offset: searchResults.offset,
      estimatedTotalHits: searchResults.estimatedTotalHits,
      facetDistribution: searchResults.facetDistribution,
    }
  } catch (error) {
    console.warn('❌ Error searching via Direct Meilisearch:', error)
    throw error
  }
}

/**
 * Main search function that routes to the appropriate implementation
 */
async function searchContests(
  params: SearchParams = {},
): Promise<SearchResult> {
  if (USE_DIRECT_MEILISEARCH) {
    return searchViaDirectMeilisearch(params)
  } else {
    return searchViaAppwriteFunction(params)
  }
}

// Log current configuration on module load
// console.log(
//   `🔧 Search Mode: ${
//     USE_DIRECT_MEILISEARCH ? 'Direct Meilisearch' : 'Appwrite Function'
//   }`
// )

// Platform-specific storage
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    } else {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default
      return await AsyncStorage.getItem(key)
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
    } else {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default
      await AsyncStorage.setItem(key, value)
    }
  },
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Recent search functions
const saveSearchQuery = async (query: string) => {
  if (!query.trim()) return

  try {
    // Save to recent searches
    const recentSearches = await getRecentSearches()
    const updatedRecent = [
      query,
      ...recentSearches.filter((q) => q !== query),
    ].slice(0, 10) // Keep only last 10 searches

    await storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedRecent))
  } catch (error) {
    console.warn('Error saving search query:', error)
  }
}

const getRecentSearches = async (): Promise<string[]> => {
  try {
    const stored = await storage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Error getting recent searches:', error)
    return []
  }
}

const clearRecentSearches = async () => {
  try {
    await storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]))
  } catch (error) {
    console.warn('Error clearing recent searches:', error)
  }
}

// Search state persistence functions
const saveSearchState = async (state: {
  query: string
  hits: Contest[]
  filters: Record<string, any>
  facets: Record<string, Record<string, number>>
  offset: number
  hasMore: boolean
}) => {
  try {
    await storage.setItem(SEARCH_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Error saving search state:', error)
  }
}

const getSearchState = async (): Promise<{
  query: string
  hits: Contest[]
  filters: Record<string, any>
  facets: Record<string, Record<string, number>>
  offset: number
  hasMore: boolean
} | null> => {
  try {
    const stored = await storage.getItem(SEARCH_STATE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.warn('Error getting search state:', error)
    return null
  }
}

// Synchronous version for web only (used for initial state)
const getSearchStateSync = (): {
  query: string
  hits: Contest[]
  filters: Record<string, any>
  facets: Record<string, Record<string, number>>
  offset: number
  hasMore: boolean
} | null => {
  if (Platform.OS !== 'web') return null

  try {
    const stored = localStorage.getItem(SEARCH_STATE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.warn('Error getting search state sync:', error)
    return null
  }
}

const clearSearchState = async () => {
  try {
    await storage.setItem(SEARCH_STATE_KEY, JSON.stringify(null))
  } catch (error) {
    console.warn('Error clearing search state:', error)
  }
}

// Contest type definition
type Contest = {
  id?: string
  $id?: string
  slug?: string
  title: string
  title_ms?: string
  start_date: string
  end_date: string
  preview_img?: string
  host_names?: string[]
  category_names_en?: string[]
  category_names_ms?: string[]
}

// Storage keys
const RECENT_SEARCHES_KEY = 'recent_searches'
const SEARCH_STATE_KEY = 'search_state'

// Search state interface
interface SearchState {
  hits: Contest[]
  query: string
  isLoading: boolean
  hasMore: boolean
  offset: number
  filters: Record<string, any>
  facets: Record<string, Record<string, number>>
}

// Search Box Component
function SearchBox({
  value,
  onChange,
  onSearch,
  isDarkColorScheme,
}: {
  value: string
  onChange: (text: string) => void
  onSearch: () => void
  isDarkColorScheme: boolean
}) {
  const { t } = useLingui()

  const handleClear = () => {
    onChange('')
  }

  return (
    <View className="px-4 pt-2 pb-2">
      <View className="relative flex-row items-center">
        <Input
          placeholder={t`Search contests...`}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSearch}
          className="text-lg web:mt-3 pr-10 flex-1"
        />
        {value.length > 0 && (
          <Pressable
            style={[
              styles.clearButton,
              {
                backgroundColor: isDarkColorScheme
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              className={`text-lg font-semibold leading-5 ${
                isDarkColorScheme ? 'text-gray-300' : 'text-gray-600'
              }`}
              style={
                Platform.OS === 'web' ? { marginTop: -2 } : { paddingTop: 0 }
              }
            >
              ×
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

// Filter Component
function Filters({
  isModalOpen,
  onToggleModal,
  filters,
  facets,
  onFilterChange,
  onClearFilters,
  hasUserSearched,
  language,
}: {
  isModalOpen: boolean
  onToggleModal: () => void
  filters: Record<string, any>
  facets: Record<string, Record<string, number>>
  onFilterChange: (key: string, value: any) => void
  onClearFilters: () => void
  hasUserSearched: boolean
  language: 'en' | 'ms'
}) {
  const { isDarkColorScheme } = useColorScheme()
  const activeFilters = Object.keys(filters).length

  // Disable parent scroll when filter modal is open (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else if (Platform.OS === 'web' && !isModalOpen) {
      document.body.style.overflow = ''
    }

    return () => {
      if (Platform.OS === 'web') {
        document.body.style.overflow = ''
      }
    }
  }, [isModalOpen])

  // Check if there are any facets available to filter by
  const hasAvailableFacets = Object.keys(facets).some((key) => {
    const facetData = facets[key] || {}
    return Object.keys(facetData).length > 0
  })

  // Close modal if no facets are available and user has searched
  useEffect(() => {
    if (isModalOpen && !hasAvailableFacets && hasUserSearched) {
      onToggleModal()
    }
  }, [isModalOpen, hasAvailableFacets, hasUserSearched, onToggleModal])

  // Helper function to render filter section
  const renderFilterSection = (sectionKey: string, sectionTitle: string) => {
    const sectionFacets = facets[sectionKey] || {}
    const hasFacets = Object.keys(sectionFacets).length > 0

    if (!hasFacets) return null

    return (
      <View className="mb-6">
        <Text
          className={`text-sm font-semibold ${
            isDarkColorScheme ? 'text-white' : 'text-gray-800'
          }`}
        >
          <Trans>{sectionTitle}</Trans>
        </Text>
        {Object.entries(sectionFacets)
          .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
          .map(([value, count]) => {
            const isSelected = filters[sectionKey]?.includes?.(value) || false

            return (
              <Pressable
                key={value}
                className={`py-2.5 flex-row justify-between items-center border-b ${
                  isDarkColorScheme ? 'border-gray-700' : 'border-gray-100'
                }`}
                onPress={() => {
                  if (isSelected) {
                    // Remove filter
                    const newValues = filters[sectionKey].filter(
                      (v: string) => v !== value,
                    )
                    onFilterChange(
                      sectionKey,
                      newValues.length > 0 ? newValues : undefined,
                    )
                  } else {
                    // Add filter
                    const currentValues = filters[sectionKey] || []
                    onFilterChange(sectionKey, [...currentValues, value])
                  }
                }}
              >
                <Text
                  className={`text-sm ${
                    isSelected ? 'font-extrabold' : 'font-normal'
                  }`}
                >
                  {value}
                </Text>

                <Badge variant="secondary" className="mr-3 h-6 px-2">
                  <Text className="text-xs">{count}</Text>
                </Badge>
              </Pressable>
            )
          })}
      </View>
    )
  }

  return (
    <>
      {hasAvailableFacets && hasUserSearched && (
        <Pressable
          className={`py-3 px-4 flex-row justify-center items-center border-t ${
            isDarkColorScheme ? 'border-gray-700' : 'border-gray-200'
          }`}
          onPress={onToggleModal}
        >
          <View className="flex-row items-center">
            <IconWrapper Icon={FunnelOutline} size={20} colorInverted={true} />
            <View className="w-2" />
            <Text className="text-base font-semibold">
              <Trans>Filters</Trans>
            </Text>
          </View>
          {activeFilters > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 px-1.5 min-h-[20px] justify-center"
            >
              <Text className="text-xs text-white font-semibold">
                {activeFilters}
              </Text>
            </Badge>
          )}
        </Pressable>
      )}

      <Modal animationType="slide" visible={isModalOpen}>
        <SafeAreaView
          className={`flex-1 ${isDarkColorScheme ? 'bg-black' : 'bg-white'}`}
        >
          <View className="flex-1 p-4">
            <View
              className={`items-center pb-4 border-b ${
                isDarkColorScheme ? 'border-gray-700' : 'border-gray-200'
              }`}
            >
              <Text className="text-xl font-bold">
                <Trans>Filters</Trans>
              </Text>
            </View>
            <ScrollView className="flex-1 mt-4">
              {renderFilterSection('status', 'Status')}
              {renderFilterSection('host_names', 'Hosts')}
              {renderFilterSection(
                language === 'ms' ? 'category_names_ms' : 'category_names_en',
                'Categories',
              )}
            </ScrollView>
            <View className="pt-1 pb-0.5 items-center">
              <Text
                className={`text-xs text-center opacity-60 ${
                  isDarkColorScheme ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                <Trans>Click to select, click again to unselect</Trans>
              </Text>
            </View>
          </View>
          <View className="flex-row p-4 pt-2">
            <Button
              variant="outline"
              onPress={() => {
                onClearFilters()
                onToggleModal()
              }}
              className="flex-1 mr-2"
            >
              <Text>
                <Trans>Clear all</Trans>
              </Text>
            </Button>
            <Button onPress={onToggleModal} className="flex-1 ml-2">
              <Text>
                <Trans>See results</Trans>
              </Text>
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  )
}

// Default Search View Component
function DefaultSearchView({
  onQuerySelect,
  isDarkColorScheme,
}: {
  onQuerySelect: (query: string) => void
  isDarkColorScheme: boolean
}) {
  const [recentQueries, setRecentQueries] = useState<string[]>([])

  const loadRecentSearches = async () => {
    const recent = await getRecentSearches()
    setRecentQueries(recent)
  }

  useEffect(() => {
    loadRecentSearches()
  }, [])

  const handleClearHistory = async () => {
    await clearRecentSearches()
    setRecentQueries([])
  }

  if (recentQueries.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-10">
        <Text
          className={`text-base text-center ${
            isDarkColorScheme ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          <Trans>Start typing to search for contests...</Trans>
        </Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
      {/* Recent Searches */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text
            className={`text-base font-semibold ${
              isDarkColorScheme ? 'text-white' : 'text-gray-800'
            }`}
          >
            <Trans>Recent Searches</Trans>
          </Text>
          <Button
            variant="outline"
            onPress={handleClearHistory}
            className="h-8 px-3"
          >
            <Text className="text-xs">
              <Trans>Clear History</Trans>
            </Text>
          </Button>
        </View>
        <View className="flex-row flex-wrap">
          {recentQueries.map((query, index) => (
            <Badge
              key={`recent-${index}`}
              variant="secondary"
              className="mr-2 mb-2"
              onPress={() => onQuerySelect(query)}
            >
              <Text className="text-base">{query}</Text>
            </Badge>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

// Hit Component (Individual Contest Item)
function Hit({
  hit,
  onPress,
  language,
}: {
  hit: Contest
  onPress: (contestId: string) => void
  jwt: string | null
  language: 'en' | 'ms'
}) {
  const handlePress = () => {
    onPress((hit as any).slug || hit.id || hit.$id || '')
  }

  // Create image source with Android-specific handling
  const getImageSource = () => {
    if (!hit.preview_img) return null

    // For Meilisearch, the token is already in the URL
    // Contest images are public, remove token from URL
    const url = new URL(hit.preview_img)
    const baseUri = `${url.origin}${url.pathname}?${url.searchParams
      .toString()
      .replace(/[&?]token=[^&]*/, '')}`

    return { uri: baseUri }
  }

  const imageSource = getImageSource()

  // Determine contest status
  const now = dayjs()
  const endDate = dayjs(hit.end_date)
  const isExpired = endDate.isBefore(now)
  const status = isExpired ? <Trans>Ended</Trans> : <Trans>Active</Trans>

  // Format host names with localization
  const hostText = (() => {
    const hostNames = hit.host_names || []
    if (hostNames.length === 0) return <Trans>By Unknown Host</Trans>
    if (hostNames.length === 1) return <Trans>By {hostNames[0]}</Trans>
    if (hostNames.length === 2)
      return (
        <Trans>
          By {hostNames[0]} & {hostNames[1]}
        </Trans>
      )

    // For 3 or more hosts: "By Host1, Host2, Host3 & Host4"
    const allButLast = hostNames.slice(0, -1).join(', ')
    const lastHost = hostNames[hostNames.length - 1]
    return (
      <Trans>
        By {allButLast} & {lastHost}
      </Trans>
    )
  })()

  const contestTitle =
    language === 'ms'
      ? hit.title_ms || hit.title // Fall back to English if Malay not available
      : hit.title

  // Get localized content based on language preference
  const categoryNames =
    language === 'ms'
      ? hit.category_names_ms || []
      : hit.category_names_en || []

  return (
    <View className="flex-1 m-1.5">
      <Card className="overflow-hidden w-full">
        {/* Pressable Content (Image) */}
        <Pressable onPress={handlePress}>
          {imageSource && (
            <CardContent className="p-0 relative">
              <ExpoImage
                source={imageSource}
                style={styles.previewImage}
                contentFit="cover"
                placeholder={{
                  blurhash:
                    '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[',
                }}
              />
              {/* Status Badge Overlay */}
              <View className="absolute top-2 right-2 z-10">
                <Badge
                  variant="outline"
                  className={
                    isExpired
                      ? 'bg-red-600 border-red-700'
                      : 'bg-blue-700 border-blue-800'
                  }
                >
                  <Text className="text-white text-xs font-semibold">
                    {status}
                  </Text>
                </Badge>
              </View>
            </CardContent>
          )}
        </Pressable>
        <CardHeader className="p-3 space-y-0 gap-1">
          <Pressable onPress={handlePress}>
            <View className="flex-row items-start gap-3">
              <View className="flex-col gap-1 flex-1">
                <CardTitle className="text-sm leading-tight" numberOfLines={1}>
                  {contestTitle}
                </CardTitle>
                <Text
                  className="text-xs text-gray-600 dark:text-gray-400"
                  numberOfLines={1}
                >
                  {hostText}
                </Text>
              </View>
            </View>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{
              alignItems: 'center',
              paddingRight: 4,
            }}
          >
            {categoryNames?.map((category, index) => (
              <Badge
                key={index}
                variant="outline"
                className="bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700 mr-1"
              >
                <Text className="text-gray-700 dark:text-neutral-200 text-xs">
                  {category}
                </Text>
              </Badge>
            ))}
          </ScrollView>
        </CardHeader>
      </Card>
    </View>
  )
}

// Search service error types
type SearchErrorType =
  | 'service_unavailable'
  | 'expired_trial'
  | 'network'
  | 'unknown'

interface SearchErrorInfo {
  type: SearchErrorType
  title: string
  message: string
  icon: string
}

// Helper to determine error type from error message
function getSearchErrorInfo(errorMessage: string): SearchErrorInfo {
  // Check for 404 - typically means the index doesn't exist or configuration issue
  if (errorMessage.includes('404')) {
    return {
      type: 'expired_trial',
      title: 'Search Service Inactive',
      message:
        'The search service is currently inactive. This may be due to a configuration issue. Please contact support if this persists.',
      icon: '⏸️',
    }
  }

  // Check for network errors
  if (
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('Failed to fetch')
  ) {
    return {
      type: 'network',
      title: 'Connection Error',
      message:
        'Unable to connect to the search service. Please check your internet connection and try again.',
      icon: '📡',
    }
  }

  // Check for 500 or other server errors
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503')
  ) {
    return {
      type: 'service_unavailable',
      title: 'Service Temporarily Down',
      message:
        'The search service is experiencing issues. Our team has been notified. Please try again in a few minutes.',
      icon: '🔧',
    }
  }

  // Default unknown error
  return {
    type: 'unknown',
    title: 'Search Unavailable',
    message:
      'Something went wrong with the search service. Please try again later.',
    icon: '🔍',
  }
}

// Search service error message component
function SearchServiceError({
  isDarkColorScheme,
  errorInfo,
  onRetry,
}: {
  isDarkColorScheme: boolean
  errorInfo: SearchErrorInfo
  onRetry?: () => void
}) {
  // Get translated title based on error type
  const getTranslatedTitle = () => {
    switch (errorInfo.type) {
      case 'expired_trial':
        return <Trans>Search Service Inactive</Trans>
      case 'network':
        return <Trans>Connection Error</Trans>
      case 'service_unavailable':
        return <Trans>Service Temporarily Down</Trans>
      default:
        return <Trans>Search Unavailable</Trans>
    }
  }

  // Get translated message based on error type
  const getTranslatedMessage = () => {
    switch (errorInfo.type) {
      case 'expired_trial':
        return (
          <Trans>
            The search service is currently inactive. This may be due to a
            configuration issue. Please contact support if this persists.
          </Trans>
        )
      case 'network':
        return (
          <Trans>
            Unable to connect to the search service. Please check your internet
            connection and try again.
          </Trans>
        )
      case 'service_unavailable':
        return (
          <Trans>
            The search service is experiencing issues. Our team has been
            notified. Please try again in a few minutes.
          </Trans>
        )
      default:
        return (
          <Trans>
            Something went wrong with the search service. Please try again
            later.
          </Trans>
        )
    }
  }

  return (
    <View className="flex-1 justify-center items-center p-10 pt-20">
      <View className="items-center max-w-sm">
        <Text className="text-3xl mb-5">{errorInfo.icon}</Text>
        <Text
          className={`text-xl font-bold text-center mb-3 ${
            isDarkColorScheme ? 'text-white' : 'text-gray-900'
          }`}
        >
          {getTranslatedTitle()}
        </Text>
        <Text
          className={`text-base text-center leading-6 mb-6 ${
            isDarkColorScheme ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {getTranslatedMessage()}
        </Text>
        {onRetry && (
          <Button variant="outline" onPress={onRetry} className="mt-2">
            <Text>
              <Trans>Try Again</Trans>
            </Text>
          </Button>
        )}
        <Text
          className={`text-xs text-center mt-6 ${
            isDarkColorScheme ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          <Trans>You can still browse contests from the home page</Trans>
        </Text>
      </View>
    </View>
  )
}

export default function SearchScreen() {
  const { isDarkColorScheme } = useColorScheme()
  const [isFilterModalOpen, setFilterModalOpen] = useState(false)
  const { bottom } = useSafeArea()
  const listRef = useRef<any>(null)
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // JWT for Android image authentication
  const [jwt, setJwt] = useState<string | null>(null)

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
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Search state with lazy initialization to restore from storage synchronously (web only)
  const [searchQuery, setSearchQuery] = useState(() => {
    const savedState = getSearchStateSync()
    return savedState?.query || ''
  })

  const [hasUserSearched, setHasUserSearched] = useState(() => {
    const savedState = getSearchStateSync()
    return savedState ? true : false
  })

  const [hasPermissionError, setHasPermissionError] = useState(false)
  const [searchServiceError, setSearchServiceError] =
    useState<SearchErrorInfo | null>(null)
  const [hasRestoredState, setHasRestoredState] = useState(
    Platform.OS === 'web',
  )

  const [searchState, setSearchState] = useState<SearchState>(() => {
    const savedState = getSearchStateSync()
    if (savedState) {
      // Clear the saved state immediately after reading
      if (Platform.OS === 'web') {
        localStorage.removeItem(SEARCH_STATE_KEY)
      }
      return {
        hits: savedState.hits,
        query: savedState.query,
        isLoading: false,
        hasMore: savedState.hasMore,
        offset: savedState.offset,
        filters: savedState.filters,
        facets: savedState.facets,
      }
    }
    return {
      hits: [],
      query: '',
      isLoading: false,
      hasMore: true,
      offset: 0,
      filters: {},
      facets: {},
    }
  })

  // Debounce search query
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Use the navigation hook for scroll position management
  const { navigateToContest: originalNavigateToContest } = useContestNavigation(
    {
      baseUrl: '/search',
    },
  )

  // Wrap navigateToContest to save search state before navigation
  const navigateToContest = useCallback(
    async (contestId: string) => {
      // Save current search state before navigating
      if (searchQuery.trim() || searchState.hits.length > 0) {
        await saveSearchState({
          query: searchQuery,
          hits: searchState.hits,
          filters: searchState.filters,
          facets: searchState.facets,
          offset: searchState.offset,
          hasMore: searchState.hasMore,
        })
      }
      originalNavigateToContest(contestId)
    },
    [searchQuery, searchState, originalNavigateToContest],
  )

  // Restore search state on mount for mobile (web is handled synchronously in useState)
  useEffect(() => {
    if (Platform.OS !== 'web' && user && !authLoading && !hasRestoredState) {
      // For mobile, restore asynchronously
      getSearchState().then((savedState) => {
        if (savedState && savedState.query) {
          // Restore search state in a single batch update
          setSearchQuery(savedState.query)
          setSearchState({
            hits: savedState.hits,
            query: savedState.query,
            isLoading: false,
            hasMore: savedState.hasMore,
            offset: savedState.offset,
            filters: savedState.filters,
            facets: savedState.facets,
          })
          setHasUserSearched(true)

          // Clear the saved state after restoring
          clearSearchState()
        }
        // Mark as restored whether we found state or not
        setHasRestoredState(true)
      })
    }
  }, [user, authLoading, hasRestoredState])

  // Initialize JWT for Android (only for authenticated users)
  useEffect(() => {
    const initializeJwt = async () => {
      if (Platform.OS === 'android') {
        // Only create JWT for authenticated users
        if (user && !authLoading) {
          try {
            const { jwt: token } = await account.createJWT()
            setJwt(token)
          } catch (error) {
            console.warn('Error creating JWT for Android:', error)
          }
        }
      }
    }

    initializeJwt()
  }, [user, authLoading])

  // Perform search
  const performSearch = useCallback(
    async (
      query: string = debouncedQuery,
      filters: Record<string, any> = searchState.filters,
      offset: number = 0,
      append: boolean = false,
    ) => {
      // Check if user is authenticated
      if (!user) {
        console.log('User not authenticated, skipping search')
        setSearchState((prev) => ({ ...prev, isLoading: false }))
        return
      }

      try {
        setSearchState((prev) => ({ ...prev, isLoading: true }))

        // Save search query to recent searches (only for non-empty queries)
        if (query.trim() && !append) {
          await saveSearchQuery(query.trim())
        }

        const searchParams: SearchParams = {
          query,
          filters,
          limit: 20,
          offset,
          attributesToRetrieve: ['*'],
          attributesToHighlight: [
            'title',
            'title_ms',
            'summary',
            'summary_ms',
            'host_names',
            'category_names_en',
            'category_names_ms',
          ],
          facets: ['host_names', 'category_names_en', 'category_names_ms'], // Add facets for filtering
        }

        const result = await searchContests(searchParams)

        setSearchState((prev) => ({
          ...prev,
          hits: append ? [...prev.hits, ...result.hits] : result.hits,
          query,
          isLoading: false,
          hasMore: result.hits.length === 20, // Has more if we got a full page
          offset: append
            ? prev.offset + result.hits.length
            : result.hits.length,
          filters,
          facets: result.facetDistribution || {},
        }))
      } catch (error: any) {
        console.warn('Search error:', error)

        // Check if it's a permission error
        const isPermissionError =
          error?.message?.includes('Missing "execute" permission') ||
          error?.message?.includes('permission') ||
          error?.message?.includes('scope') ||
          error?.message?.includes('users') ||
          error?.message?.includes('guests')

        // Check if it's a Meilisearch service error (404, 500, network errors)
        const isMeilisearchError =
          error?.message?.includes('404') ||
          error?.message?.includes('500') ||
          error?.message?.includes('502') ||
          error?.message?.includes('503') ||
          error?.message?.includes('Network request failed') ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('Meilisearch API error')

        if (isPermissionError) {
          console.log('Permission error detected, showing auth message')
          setHasPermissionError(true)
        } else if (isMeilisearchError) {
          console.warn('Meilisearch service error detected')
          const errorInfo = getSearchErrorInfo(error?.message || '')
          setSearchServiceError(errorInfo)
        }

        setSearchState((prev) => ({ ...prev, isLoading: false }))
      }
    },
    [debouncedQuery, searchState.filters, user],
  )

  // Initial search to populate facets (but don't mark as user search)
  useEffect(() => {
    // Only perform initial search if user is authenticated and we've checked for restored state
    if (user && !authLoading && hasRestoredState && !searchQuery.trim()) {
      // Perform initial search to get facets even without query
      performSearch('', searchState.filters, 0, false)
    }
  }, [user, authLoading, hasRestoredState]) // Add hasRestoredState as dependency

  // Search when query changes
  useEffect(() => {
    // Skip search if we haven't restored state yet
    if (!hasRestoredState) {
      return
    }

    if (debouncedQuery.trim()) {
      if (user) {
        setHasUserSearched(true)
        performSearch(debouncedQuery, searchState.filters, 0, false)
      }
    } else {
      // Clear user search flag when query is cleared
      setHasUserSearched(false)
      // Don't clear facets when query is empty - keep them for filtering
      setSearchState((prev) => ({
        ...prev,
        hits: [],
        query: '',
        isLoading: false,
        hasMore: true,
        offset: 0,
        // Keep facets even when clearing results
      }))
    }
  }, [debouncedQuery, user, hasRestoredState])

  // Clear permission error when user changes or successfully searches
  useEffect(() => {
    if (user && !authLoading) {
      setHasPermissionError(false)
    }
  }, [user, authLoading])

  // Clear errors when search is successful
  useEffect(() => {
    if (searchState.hits.length > 0) {
      setHasPermissionError(false)
      setSearchServiceError(null)
    }
  }, [searchState.hits])

  // Retry search handler
  const handleRetrySearch = useCallback(() => {
    setSearchServiceError(null)
    if (searchQuery.trim()) {
      performSearch(searchQuery, searchState.filters, 0, false)
    } else {
      performSearch('', {}, 0, false)
    }
  }, [searchQuery, searchState.filters, performSearch])

  // Load more results
  const loadMore = useCallback(() => {
    if (!searchState.isLoading && searchState.hasMore) {
      performSearch(
        searchState.query,
        searchState.filters,
        searchState.offset,
        true,
      )
    }
  }, [
    searchState.isLoading,
    searchState.hasMore,
    searchState.query,
    searchState.filters,
    searchState.offset,
    performSearch,
  ])

  // Handle filter changes
  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      const newFilters = { ...searchState.filters }
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete newFilters[key]
      } else {
        newFilters[key] = value
      }

      performSearch(searchState.query, newFilters, 0, false)
    },
    [searchState.filters, searchState.query, performSearch],
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    performSearch(searchState.query, {}, 0, false)
  }, [searchState.query, performSearch])

  // Handle query selection from suggestions
  const handleQuerySelect = useCallback((query: string) => {
    setSearchQuery(query)
    // The search will be triggered by the useEffect when debouncedQuery changes
  }, [])

  // Render loading state
  const renderLoading = () => (
    <View className="flex-1 justify-center items-center p-5">
      <ActivityIndicator color="grey" />
      <Text className="text-lg text-gray-500 text-center mt-4">
        <Trans>Searching for contests...</Trans>
      </Text>
    </View>
  )

  // Render empty state
  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center p-5">
      <Text className="text-lg text-gray-500 text-center">
        <Trans>No contests found. Try a different search term.</Trans>
      </Text>
    </View>
  )

  // Render default state (when no search query)
  const renderDefaultState = () => (
    <DefaultSearchView
      onQuerySelect={handleQuerySelect}
      isDarkColorScheme={isDarkColorScheme}
    />
  )

  // Render list footer
  const renderFooter = () => {
    if (!searchState.hasMore) return null

    return (
      <View className="p-5 items-center">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-gray-500 mt-2">
          <Trans>Loading more...</Trans>
        </Text>
      </View>
    )
  }

  return (
    <>
      <SafeAreaView
        className={`flex-1 ${isDarkColorScheme ? 'bg-black' : 'bg-white'}`}
        style={{
          paddingTop: Platform.OS === 'web' ? 80 : 0,
          paddingBottom: bottom,
        }}
      >
        <StatusBar
          barStyle={isDarkColorScheme ? 'light-content' : 'dark-content'}
        />

        {user && !authLoading && !hasPermissionError ? (
          /* Logged in state - show title at top */
          <>
            <Text className="text-2xl font-bold color-main text-center mb-4 native:hidden">
              <Trans>Search Contests</Trans>
            </Text>
            {/* Search header */}
          </>
        ) : !user && !authLoading ? (
          /* Not logged in state - show title at top (horizontally centered) */
          <View className="flex-1 items-center p-10 pt-4">
            <View className="items-center max-w-xs">
              <Text className="text-2xl font-bold color-main text-center mb-6 native:hidden">
                <Trans>Search Contests</Trans>
              </Text>
              <Text
                className={`text-base text-center leading-6 mb-6 ${
                  isDarkColorScheme ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                <Trans>
                  Please sign in or register to use our search function -
                  powered by AI.
                </Trans>
              </Text>
              <View className="w-full items-center">
                <Button
                  onPress={() =>
                    router.push('/sign-in-register?redirect=/search')
                  }
                  className="mt-4"
                >
                  <Text>
                    <Trans>Sign In / Register</Trans>
                  </Text>
                </Button>
              </View>
            </View>
          </View>
        ) : (
          /* Loading state - show title at top */
          <Text className="text-2xl font-bold color-main text-center mb-4 native:hidden">
            <Trans>Search Contests</Trans>
          </Text>
        )}

        {/* Only show search header if user is authenticated, no permission error, and no service error */}
        {user && !authLoading && !hasPermissionError && !searchServiceError && (
          <View
            className={`border-b ${
              isDarkColorScheme
                ? 'border-gray-700 bg-black'
                : 'border-gray-200 bg-white'
            }`}
          >
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={() => {
                setHasUserSearched(true)
                performSearch(searchQuery, searchState.filters, 0, false)
              }}
              isDarkColorScheme={isDarkColorScheme}
            />
            <Filters
              isModalOpen={isFilterModalOpen}
              onToggleModal={() => setFilterModalOpen(!isFilterModalOpen)}
              filters={searchState.filters}
              facets={searchState.facets}
              onFilterChange={handleFilterChange}
              onClearFilters={clearFilters}
              hasUserSearched={hasUserSearched}
              language={language}
            />
          </View>
        )}

        {/* Show search service error when Meilisearch is unavailable */}
        {user && !authLoading && !hasPermissionError && searchServiceError && (
          <SearchServiceError
            isDarkColorScheme={isDarkColorScheme}
            errorInfo={searchServiceError}
            onRetry={handleRetrySearch}
          />
        )}

        {/* Only show content when user is authenticated and no service error */}
        {user && !authLoading && !hasPermissionError && !searchServiceError && (
          <View className="flex-1">
            {!searchQuery.trim() ? (
              renderDefaultState()
            ) : searchState.isLoading && searchState.hits.length === 0 ? (
              renderLoading()
            ) : searchState.hits.length === 0 ? (
              renderEmpty()
            ) : (
              <FlashList
                ref={listRef}
                data={searchState.hits}
                renderItem={({ item }) => (
                  <Hit
                    hit={item}
                    onPress={navigateToContest}
                    jwt={jwt}
                    language={language}
                  />
                )}
                keyExtractor={(item) => {
                  // Prefer stable unique ids; fall back to slug combined with dates or title
                  if (item.$id) return item.$id
                  if (item.id) return item.id
                  const slugOrTitle = item.slug || item.title || 'contest'
                  const start = item.start_date || ''
                  const end = item.end_date || ''
                  return `${slugOrTitle}-${start}-${end}`
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={renderFooter}
                numColumns={2}
                contentContainerStyle={{ padding: 8 }}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  clearButton: {
    position: 'absolute',
    right: 12,
    ...(Platform.OS === 'web'
      ? {
          top: '50%',
          transform: [{ translateY: -6 }],
        }
      : {
          top: '50%',
          marginTop: -12,
        }),
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  previewImage: {
    width: '100%',
    height: 170, // adjust height of previewImage
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
})
