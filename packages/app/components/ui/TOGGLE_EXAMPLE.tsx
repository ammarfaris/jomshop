/**
 * Example usage of Toggle component with custom icons-svg system
 *
 * This file demonstrates how to use the Toggle component with your custom icon system.
 * You can copy and adapt these examples for your actual implementation.
 */

import * as React from 'react'
import { View } from 'react-native'
import { Toggle, ToggleIcon } from './toggle'
import { Text } from './text'

// Import your custom icons
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'
import { BellAlertOutline } from 'app/components/icons-svg/BellAlertOutline'
import { BellAlertSolid } from 'app/components/icons-svg/BellAlertSolid'
import { ArrowUpCircleOutline } from 'app/components/icons-svg/ArrowUpCircleOutline'
import { ArrowUpCircleSolid } from 'app/components/icons-svg/ArrowUpCircleSolid'

/**
 * Example 1: Simple icon-only toggle (e.g., bookmark button)
 */
export function BookmarkToggleExample() {
  const [isBookmarked, setIsBookmarked] = React.useState(false)

  return (
    <Toggle
      pressed={isBookmarked}
      onPressedChange={setIsBookmarked}
      aria-label="Toggle bookmark"
    >
      <ToggleIcon as={isBookmarked ? BookmarkSolidIcon : BookmarkIcon} />
    </Toggle>
  )
}

/**
 * Example 2: Toggle with outline variant (e.g., notification toggle)
 */
export function NotificationToggleExample() {
  const [isEnabled, setIsEnabled] = React.useState(false)

  return (
    <Toggle
      pressed={isEnabled}
      onPressedChange={setIsEnabled}
      variant="outline"
      aria-label="Toggle notifications"
    >
      <ToggleIcon as={isEnabled ? BellAlertSolid : BellAlertOutline} />
    </Toggle>
  )
}

/**
 * Example 3: Toggle with text and icon (e.g., upvote button)
 */
export function UpvoteToggleExample() {
  const [isUpvoted, setIsUpvoted] = React.useState(false)
  const [count, setCount] = React.useState(42)

  const handleToggle = (pressed: boolean) => {
    setIsUpvoted(pressed)
    setCount((prev) => (pressed ? prev + 1 : prev - 1))
  }

  return (
    <Toggle
      pressed={isUpvoted}
      onPressedChange={handleToggle}
      variant="outline"
      aria-label="Upvote"
    >
      <ToggleIcon as={isUpvoted ? ArrowUpCircleSolid : ArrowUpCircleOutline} />
      <Text>{count}</Text>
    </Toggle>
  )
}

/**
 * Example 4: Different sizes
 */
export function ToggleSizesExample() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <View className="flex flex-row gap-4">
      {/* Small */}
      <Toggle
        pressed={pressed}
        onPressedChange={setPressed}
        size="sm"
        variant="outline"
      >
        <ToggleIcon as={pressed ? BookmarkSolidIcon : BookmarkIcon} />
        <Text>Small</Text>
      </Toggle>

      {/* Default */}
      <Toggle pressed={pressed} onPressedChange={setPressed} variant="outline">
        <ToggleIcon as={pressed ? BookmarkSolidIcon : BookmarkIcon} />
        <Text>Default</Text>
      </Toggle>

      {/* Large */}
      <Toggle
        pressed={pressed}
        onPressedChange={setPressed}
        size="lg"
        variant="outline"
      >
        <ToggleIcon as={pressed ? BookmarkSolidIcon : BookmarkIcon} />
        <Text>Large</Text>
      </Toggle>
    </View>
  )
}

/**
 * Example 5: Custom styled toggle with className
 */
export function CustomStyledToggleExample() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <Toggle
      pressed={pressed}
      onPressedChange={setPressed}
      variant="outline"
      className="rounded-full"
    >
      <ToggleIcon
        as={pressed ? BellAlertSolid : BellAlertOutline}
        className="text-blue-500"
      />
    </Toggle>
  )
}

/**
 * Example 6: Disabled toggle
 */
export function DisabledToggleExample() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <Toggle
      pressed={pressed}
      onPressedChange={setPressed}
      disabled
      variant="outline"
    >
      <ToggleIcon as={BookmarkIcon} />
      <Text>Disabled</Text>
    </Toggle>
  )
}

/**
 * Example 7: Group of toggles (e.g., filter buttons)
 */
export function ToggleGroupExample() {
  const [activeFilters, setActiveFilters] = React.useState<Set<string>>(
    new Set()
  )

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(filter)) {
        newSet.delete(filter)
      } else {
        newSet.add(filter)
      }
      return newSet
    })
  }

  return (
    <View className="flex flex-row gap-2">
      <Toggle
        pressed={activeFilters.has('notifications')}
        onPressedChange={() => toggleFilter('notifications')}
        variant="outline"
        size="sm"
      >
        <ToggleIcon
          as={
            activeFilters.has('notifications')
              ? BellAlertSolid
              : BellAlertOutline
          }
        />
        <Text>Notifications</Text>
      </Toggle>

      <Toggle
        pressed={activeFilters.has('bookmarks')}
        onPressedChange={() => toggleFilter('bookmarks')}
        variant="outline"
        size="sm"
      >
        <ToggleIcon
          as={activeFilters.has('bookmarks') ? BookmarkSolidIcon : BookmarkIcon}
        />
        <Text>Bookmarks</Text>
      </Toggle>

      <Toggle
        pressed={activeFilters.has('upvoted')}
        onPressedChange={() => toggleFilter('upvoted')}
        variant="outline"
        size="sm"
      >
        <ToggleIcon
          as={
            activeFilters.has('upvoted')
              ? ArrowUpCircleSolid
              : ArrowUpCircleOutline
          }
        />
        <Text>Upvoted</Text>
      </Toggle>
    </View>
  )
}

/**
 * Complete demo component showing all examples
 */
export function ToggleExamplesDemo() {
  return (
    <View className="flex flex-col gap-8 p-4">
      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Simple Icon Toggle</Text>
        <BookmarkToggleExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Notification Toggle</Text>
        <NotificationToggleExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Upvote Toggle with Count</Text>
        <UpvoteToggleExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Different Sizes</Text>
        <ToggleSizesExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Custom Styled</Text>
        <CustomStyledToggleExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Disabled State</Text>
        <DisabledToggleExample />
      </View>

      <View className="flex flex-col gap-2">
        <Text className="text-lg font-semibold">Toggle Group (Filters)</Text>
        <ToggleGroupExample />
      </View>
    </View>
  )
}
