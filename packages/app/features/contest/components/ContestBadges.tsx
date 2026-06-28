import { useMemo } from 'react'
import { ScrollView, View, ScrollViewProps } from 'react-native'
import dayjs from 'dayjs'
import { Plural, Trans } from '@lingui/react/macro'

import { Badge } from 'app/components/ui/badge'
import { Text } from 'app/components/ui/text'
import { Skeleton } from 'app/components/ui/skeleton'

export type ContestBadgeCategory = {
  id: string
  name_en: string
  name_ms?: string | null
  priority_order?: number | null
  originalIndex: number
  type?:
    | 'prize'
    | 'winner_selection'
    | 'how_to_enter'
    | 'business_category'
    | null
}

interface ContestBadgesProps {
  endDate?: string | null
  language: 'en' | 'ms'
  categories?: ContestBadgeCategory[]
  scrollViewProps?: ScrollViewProps
  /** When true, shows skeleton badge placeholders inline (for loading state) */
  showCategorySkeleton?: boolean
}

export function ContestBadges({
  endDate,
  language,
  categories = [],
  scrollViewProps,
  showCategorySkeleton = false,
}: ContestBadgesProps) {
  const sortedCategories = useMemo(() => {
    // Group categories by type
    const prizeCategories = categories.filter(
      (c) => c.type === 'prize' || !c.type
    )
    const howToEnterCategories = categories.filter(
      (c) => c.type === 'how_to_enter'
    )
    const businessCategories = categories.filter(
      (c) => c.type === 'business_category'
    )
    const winnerSelectionCategories = categories.filter(
      (c) => c.type === 'winner_selection'
    )

    // Sort function: by priority_order (desc), then by sequence in category_ids array (originalIndex)
    const sortFn = (a: ContestBadgeCategory, b: ContestBadgeCategory) => {
      const ao = a.priority_order ?? Number.NEGATIVE_INFINITY
      const bo = b.priority_order ?? Number.NEGATIVE_INFINITY
      if (ao !== bo) return bo - ao
      return a.originalIndex - b.originalIndex
    }

    // Take max 1 from each type and combine in sequence: prize, business_category, how_to_enter, winner_selection
    const result = [
      ...prizeCategories.sort(sortFn).slice(0, 1),
      ...businessCategories.sort(sortFn).slice(0, 1),
      ...howToEnterCategories.sort(sortFn).slice(0, 1),
      ...winnerSelectionCategories.sort(sortFn).slice(0, 1),
    ]

    return result
  }, [categories])

  const endsBadge = useMemo(() => {
    if (!endDate) return null

    const end = dayjs(endDate)
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
          <Plural value={daysExpired} one="# day ago" other="# days ago" />
        ) : (
          <Plural value={hoursExpired} one="# hour ago" other="# hours ago" />
        )

      return (
        <Trans>
          <Badge
            variant="outline"
            className="bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800"
          >
            <Text className="text-red-700 dark:text-red-300 font-medium">
              Ended {timeText}
            </Text>
          </Badge>
        </Trans>
      )
    }

    if (hoursUntilEnd < 72) {
      const timeText = (
        <Plural value={hoursUntilEnd} one="in # hour" other="in # hours" />
      )

      return (
        <Trans>
          <Badge
            variant="outline"
            className="bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
          >
            <Text className="text-yellow-700 dark:text-yellow-300 font-medium">
              Expiring {timeText}
            </Text>
          </Badge>
        </Trans>
      )
    }

    if (hoursUntilEnd < 720) {
      const timeText = (
        <Plural value={daysUntilEnd} one="in # day" other="in # days" />
      )

      return (
        <Trans>
          <Badge
            variant="outline"
            className="bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
          >
            <Text className="text-blue-700 dark:text-blue-300 font-medium">
              Ends {timeText}
            </Text>
          </Badge>
        </Trans>
      )
    }

    const timeText = (
      <Plural value={daysUntilEnd} one="in # day" other="in # days" />
    )

    return (
      <Trans>
        <Badge
          variant="outline"
          className="bg-green-100 border-green-200 dark:bg-green-950 dark:border-green-800"
        >
          <Text className="text-green-700 dark:text-green-300 font-medium">
            Ends {timeText}
          </Text>
        </Badge>
      </Trans>
    )
  }, [endDate])

  if (!endsBadge && sortedCategories.length === 0 && !showCategorySkeleton) {
    return null
  }

  return (
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
      {...scrollViewProps}
    >
      {endsBadge ? <View style={{ marginRight: 8 }}>{endsBadge}</View> : null}
      {sortedCategories.map((category) => (
        <Badge
          key={category.id}
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
      {/* Inline skeleton placeholders while categories are loading */}
      {showCategorySkeleton && (
        <>
          <Skeleton className="h-6 w-24 rounded-full mr-2" />
          <Skeleton className="h-6 w-20 rounded-full mr-2" />
        </>
      )}
    </ScrollView>
  )
}

export default ContestBadges
