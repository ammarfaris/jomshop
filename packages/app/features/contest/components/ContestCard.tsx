import { View, Pressable, Platform } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Models } from 'app/lib/appwrite-universal'
import { useLingui, Plural } from '@lingui/react/macro'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'app/components/ui/card'
import { Text } from 'app/components/ui/text'
import { Badge } from 'app/components/ui/badge'
import { Skeleton } from 'app/components/ui/skeleton'
import { UpvoteButton } from 'app/components/UpvoteButton'
import { SaveButton } from 'app/components/SaveButton'
import { ShareButton } from 'app/components/ShareButton'
import {
  ContestBadges,
  type ContestBadgeCategory,
} from 'app/features/contest/components/ContestBadges'
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  CONTESTS_BUCKET_ID,
} from 'app/provider/appwrite/constants'
import { HostImage } from 'app/components/HostImage'

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
  savedAt?: string // Optional: timestamp when the contest was saved (for profile saved tab)
  visibility?: 'any' | 'users' | 'admin' // Visibility setting for the contest
}

type Host = Models.Document & {
  name: string
  slug: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash?: string
  bio?: string
}

interface ContestCardProps {
  contest: Contest
  hosts: Host[]
  badgeCategories: ContestBadgeCategory[]
  language: 'en' | 'ms'
  jwt?: string | null // For Android image loading
  onPress: () => void
  showSavedIndicator?: boolean // Whether to show "Saved X ago" indicator (for profile saved tab)
  numColumns?: number // For responsive layout
  onSaveChange?: (isSaved: boolean) => void // Callback for save status changes
  showReceiptButton?: boolean // Whether to show receipt upload/manage button
  receiptCount?: number // Number of receipts for this contest
  onReceiptPress?: () => void // Callback when receipt button is pressed
  onManageReceipts?: () => void // Callback to open receipt manager when clicking saved bookmark
  initialUpvoteCount?: number // For anonymous users, pass count from public-contests function
}

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

export function ContestCard({
  contest,
  hosts,
  badgeCategories,
  language,
  jwt,
  onPress,
  showSavedIndicator = false,
  numColumns = 1,
  onSaveChange,
  showReceiptButton = false,
  receiptCount = 0,
  onReceiptPress,
  onManageReceipts,
  initialUpvoteCount,
}: ContestCardProps) {
  const { t } = useLingui()

  const formatSavedTime = () => {
    if (!showSavedIndicator || !contest.savedAt) return null

    const now = new Date()
    const savedTime = new Date(contest.savedAt)
    const diffMs = now.getTime() - savedTime.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) {
      return t`Saved just now`
    } else if (diffMinutes < 60) {
      return t`Saved ${diffMinutes} ${
        diffMinutes === 1 ? 'minute' : 'minutes'
      } ago`
    } else if (diffHours < 24) {
      return t`Saved ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    } else {
      return t`Saved ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    }
  }

  const getHostsDescription = () => {
    if (hosts.length === 0) return t`By Unknown Host`
    if (hosts.length === 1) return t`By ${hosts[0]?.name || 'Unknown'}`
    if (hosts.length === 2)
      return t`By ${hosts[0]?.name || 'Unknown'} & ${
        hosts[1]?.name || 'Unknown'
      }`

    // For 3 or more hosts: "By Host1, Host2, Host3 & Host4"
    const allButLast = hosts
      .slice(0, -1)
      .map((h) => h?.name || 'Unknown')
      .join(', ')
    const lastHost = hosts[hosts.length - 1]?.name || 'Unknown'
    return t`By ${allButLast} & ${lastHost}`
  }

  return (
    <View
      style={{
        flex: 1,
        margin: numColumns === 1 ? 0 : 6,
        marginBottom: numColumns === 1 ? 16 : 12,
      }}
    >
      <Card
        key={contest.$id}
        className={`w-full relative ${
          numColumns === 1 ? 'web:max-w-4xl web:mx-auto' : ''
        }`}
      >
        {/* Admin Only Badge */}
        {contest.visibility === 'admin' && (
          <View className="absolute top-2 right-2 z-10">
            <Badge className="bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800">
              <Text className="text-xs font-semibold text-red-700 dark:text-red-300">
                Admin Only
              </Text>
            </Badge>
          </View>
        )}
        {/* Clickable area: Header + Content */}
        <Pressable onPress={onPress}>
          {/* Header */}
          <CardHeader className="flex-col gap-1 py-4">
            <View className="flex-col gap-1">
              {/* Top Row: Saved Indicator & Receipt Button */}
              <View className="flex-row items-center justify-between mb-1">
                {/* Saved Indicator - Only shown in profile saved tab */}
                {showSavedIndicator && contest.savedAt && (
                  <CardDescription className="text-sm text-red-600 dark:text-red-400">
                    {formatSavedTime()}
                  </CardDescription>
                )}
                {!showSavedIndicator && <View />}

                {/* Receipt Button */}
                {showReceiptButton && onReceiptPress && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation()
                      onReceiptPress()
                    }}
                    className="bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-full flex-row items-center gap-1 mr-[-10px]"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {receiptCount > 0 ? `📄 ${receiptCount}` : '📤'}
                    </Text>
                    <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {receiptCount > 0 ? (
                        <Plural
                          value={receiptCount}
                          one="Receipt"
                          other="Receipts"
                        />
                      ) : (
                        t`Upload`
                      )}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="flex-row items-start gap-3">
                <View className="flex-col gap-1 flex-1">
                  <CardTitle
                    className="text-lg"
                    numberOfLines={1}
                    style={{ minHeight: 24 }}
                  >
                    {language === 'ms' && contest.title_ms
                      ? contest.title_ms
                      : contest.title}
                  </CardTitle>
                  {/* Show skeleton while hosts are loading, actual text once loaded */}
                  {hosts.length === 0 &&
                  (contest.host_ids?.length ?? 0) > 0 ? (
                    <Skeleton className="h-4 w-28 rounded" />
                  ) : (
                    <CardDescription className="text-xs" numberOfLines={1}>
                      {getHostsDescription()}
                    </CardDescription>
                  )}
                </View>
                {/* Host logos next to title and description */}
                {hosts.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2 items-center">
                    {hosts.map((h) => (
                      <View key={h.$id} className="items-center justify-center">
                        <HostImage
                          imgId={h.img_id}
                          imgTokenSecret={h.img_token_secret}
                          imgBlurhash={h.img_blurhash}
                          width={60}
                          height={60}
                          borderRadius={6}
                          contentFit="contain"
                          jwt={jwt}
                        />
                      </View>
                    ))}
                  </View>
                ) : (contest.host_ids?.length ?? 0) > 0 ? (
                  /* Skeleton while hosts are still loading */
                  <View className="flex-row gap-2 items-center">
                    {contest.host_ids!.slice(0, 2).map((id) => (
                      <Skeleton
                        key={id}
                        style={{ width: 60, height: 60, borderRadius: 6 }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            {/* Always render ContestBadges (shows end date badge even without categories) */}
            {/* Skeleton badges render inline next to the end date badge while categories load */}
            <ContestBadges
              endDate={contest.end_date}
              language={language}
              categories={badgeCategories}
              showCategorySkeleton={
                badgeCategories.length === 0 &&
                (contest.category_ids?.length ?? 0) > 0
              }
            />
          </CardHeader>

          {/* Content */}
          <CardContent className="flex-col gap-2">
            {/* Image */}
            {contest.main_img_id && (
              <View>
                <ExpoImage
                  source={(() => {
                    const raw = contest.main_img_id || ''
                    // Supabase spike stores a full image URL; Appwrite stores a file id.
                    const baseUri = /^https?:\/\//i.test(raw)
                      ? raw
                      : `${APPWRITE_ENDPOINT}/storage/buckets/${CONTESTS_BUCKET_ID}/files/${raw}/view?project=${APPWRITE_PROJECT_ID}`
                    return { uri: baseUri }
                  })()}
                  style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 12,
                  }}
                  contentFit="cover"
                  placeholder={{
                    blurhash: contest.main_img_blurhash || blurhash,
                  }}
                />
              </View>
            )}
            {/* Summary */}
            <Text
              className="text-black dark:text-white mt-2 text-sm"
              numberOfLines={4}
              style={
                {
                  minHeight: 64, // ~4 lines at text-sm (16px line height)
                  ...(Platform.OS === 'web' && {
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }),
                } as any
              }
            >
              {language === 'ms' && contest.summary_ms
                ? contest.summary_ms
                : contest.summary}
            </Text>
          </CardContent>
        </Pressable>

        {/* Non-clickable Footer with action buttons */}
        <CardFooter className="mt-3 justify-center px-2">
          <View className="flex-row items-center justify-center">
            <UpvoteButton
              contestId={contest.$id}
              variant="compact"
              showCount={true}
              initialCount={initialUpvoteCount}
            />
            <View style={{ width: 20 }} />
            <SaveButton
              contestId={contest.$id}
              variant="compact"
              showText={true}
              onSaveChange={onSaveChange}
              preventAutoAction={!!onSaveChange}
              receiptCount={receiptCount}
              onManageReceipts={onManageReceipts}
              contestTitle={
                language === 'ms' && contest.title_ms
                  ? contest.title_ms
                  : contest.title
              }
            />
            <View style={{ width: 20 }} />
            <ShareButton
              contestId={contest.slug || contest.$id}
              contestTitle={
                language === 'ms' && contest.title_ms
                  ? contest.title_ms
                  : contest.title
              }
              language={language}
              variant="compact"
            />
          </View>
        </CardFooter>
      </Card>
    </View>
  )
}

export type { Contest, Host }
