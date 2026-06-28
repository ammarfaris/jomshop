import { ScrollView, Platform, Pressable, View } from 'react-native'
import { Trans } from '@lingui/react/macro'
import { Text } from 'app/components/ui/text'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { cn } from 'app/lib/utils'
import { useMemo } from 'react'

export type FilterCategory = {
  $id: string
  name_en: string
  name_ms: string
  slug: string
  priority_order?: number
  type?: 'prize' | 'winner_selection' | 'how_to_enter' | 'business_category' | null
}

interface CategoryFilterProps {
  categories: FilterCategory[]
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string | null) => void
  language: 'en' | 'ms'
  className?: string
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
  language,
  className,
}: CategoryFilterProps) {
  const { isDarkColorScheme } = useColorScheme()

  // Split categories by type and sort each by priority_order
  const { prizeCategories, winnerSelectionCategories } = useMemo(() => {
    const prize = categories
      .filter((c) => c.type === 'prize')
      .sort((a, b) => (a.priority_order ?? 999) - (b.priority_order ?? 999))
    const winnerSelection = categories
      .filter((c) => c.type === 'winner_selection')
      .sort((a, b) => (a.priority_order ?? 999) - (b.priority_order ?? 999))
    return { prizeCategories: prize, winnerSelectionCategories: winnerSelection }
  }, [categories])

  const isSelected = (categoryId: string | null) =>
    selectedCategoryId === categoryId

  const getChipClassName = (selected: boolean) => {
    if (selected) {
      return 'bg-primary border-primary'
    }
    return isDarkColorScheme
      ? 'bg-neutral-800 border-neutral-700'
      : 'bg-gray-100 border-gray-200'
  }

  const getTextClassName = (selected: boolean) => {
    if (selected) {
      return 'text-primary-foreground font-semibold'
    }
    return isDarkColorScheme ? 'text-neutral-200' : 'text-gray-700'
  }

  const renderChip = (
    categoryId: string | null,
    label: React.ReactNode,
    key?: string
  ) => (
    <Pressable
      key={key}
      onPress={() => onSelectCategory(categoryId)}
      className={cn(
        'px-3 py-1.5 rounded-full border flex-row items-center',
        getChipClassName(isSelected(categoryId))
      )}
    >
      <Text
        className={cn('text-sm', getTextClassName(isSelected(categoryId)))}
        style={{ lineHeight: 18 }}
      >
        {label}
      </Text>
    </Pressable>
  )

  return (
    <View className={cn('gap-2', className)}>
      {/* Row 1: All + Prize categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Platform.OS === 'web' ? 4 : 16,
          gap: 8,
          alignItems: 'center',
          ...(Platform.OS === 'web' && {
            flexGrow: 1,
            justifyContent: 'center',
          }),
        }}
      >
        {renderChip(null, <Trans>All</Trans>, 'all')}
        {prizeCategories.map((category) =>
          renderChip(
            category.$id,
            language === 'ms' ? category.name_ms : category.name_en,
            category.$id
          )
        )}
      </ScrollView>

      {/* Row 2: Winner Selection categories (only show if there are any) */}
      {winnerSelectionCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Platform.OS === 'web' ? 4 : 16,
            gap: 8,
            alignItems: 'center',
            ...(Platform.OS === 'web' && {
              flexGrow: 1,
              justifyContent: 'center',
            }),
          }}
        >
          {winnerSelectionCategories.map((category) =>
            renderChip(
              category.$id,
              language === 'ms' ? category.name_ms : category.name_en,
              category.$id
            )
          )}
        </ScrollView>
      )}
    </View>
  )
}
