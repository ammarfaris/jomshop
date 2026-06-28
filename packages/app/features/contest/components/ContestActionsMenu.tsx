/**
 * ContestActionsMenu Component
 *
 * A floating action menu that provides quick access to contest actions (Upvote, Save, Share).
 * This component has platform-specific implementations for web and native.
 *
 * ## Platform Differences
 *
 * ### Web Implementation
 * - Container: `<div>` with fixed positioning
 * - Position: `top: 80px, right: 20px` (accounts for navbar)
 * - Z-index: `10`
 * - Behavior: Stays fixed when scrolling
 *
 * ### Native Implementation
 * - Container: `<View>` with absolute positioning
 * - Position: `top: 8px, right: 12px` (minimal offset)
 * - Z-index: `1000` (ensures visibility above other elements)
 * - Behavior: Positioned relative to parent container
 *
 * ## Menu Contents
 * The PopoverContent and menu items are identical across platforms:
 * - Upvote button with count
 * - Save button
 * - Share button with icon
 */

import { Platform, Pressable, View } from 'react-native'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'app/components/ui/popover'
import { EllipsisHorizontalOutline } from 'app/components/icons-svg/EllipsisHorizontalOutline'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { UpvoteButton } from 'app/components/UpvoteButton'
import { SaveButton } from 'app/components/SaveButton'
import { ShareButton } from 'app/components/ShareButton'
import { useContestReceiptCount } from 'app/hooks/useReceipts'

type ContestActionsMenuProps = {
  contestId: string
  contestSlug: string
  contestTitle: string
  language: 'en' | 'ms'
  onManageReceipts?: () => void // Callback to open receipt modal from parent
  initialUpvoteCount?: number // For anonymous users
  showAds?: boolean // Whether ads are being shown (affects positioning)
}

export function ContestActionsMenu({
  contestId,
  contestSlug,
  contestTitle,
  language,
  onManageReceipts,
  initialUpvoteCount,
  showAds = false,
}: ContestActionsMenuProps) {
  const { isDarkColorScheme } = useColorScheme()

  // Get receipt count for this contest
  const { data: receiptCount = 0 } = useContestReceiptCount(contestId)

  // Calculate top position based on whether ads are shown
  // With ads: navbar (60px) + gap (6px) + ad banner (90px) + border (1px) + gap (15px) = 172px
  // Without ads: navbar (60px) + gap (6px) + gap (15px) = 81px
  const webTopPosition = showAds ? '172px' : '81px'
  // Native: with ads (100px), without ads (10px)
  const nativeTopPosition = showAds ? 100 : 10

  if (Platform.OS === 'web') {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: webTopPosition,
            right: '20px',
            zIndex: 30, // Above ad banner (z-index 25)
          }}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Pressable
                style={{
                  backgroundColor: isDarkColorScheme
                    ? 'rgba(107, 114, 128, 1)'
                    : 'rgba(156, 163, 175, 1)',
                  borderRadius: 22,
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isDarkColorScheme
                    ? '0px 4px 12px rgba(0, 0, 0, 0.4)'
                    : '0px 4px 12px rgba(0, 0, 0, 0.15)',
                  elevation: 8,
                }}
                // @ts-ignore - web only hover styles
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.transition = 'transform 0.2s ease'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <EllipsisHorizontalOutline
                  width={24}
                  height={24}
                  stroke="white"
                  strokeWidth={2}
                />
              </Pressable>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <View className="flex-col gap-6">
                <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <UpvoteButton
                    contestId={contestId}
                    variant="compact"
                    showCount={true}
                    className="justify-start"
                    initialCount={initialUpvoteCount}
                  />
                </View>
                <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <SaveButton
                    contestId={contestId}
                    variant="compact"
                    showText={true}
                    className="justify-start"
                    receiptCount={receiptCount}
                    onManageReceipts={onManageReceipts}
                    contestTitle={contestTitle}
                  />
                </View>
                <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ShareButton
                    contestId={contestSlug}
                    contestTitle={contestTitle}
                    language={language}
                    variant="compact"
                    className="justify-start"
                  />
                </View>
              </View>
            </PopoverContent>
          </Popover>
        </div>
      </>
    )
  }

  // Native implementation
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: nativeTopPosition,
          right: 12,
          zIndex: 1000,
        }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Pressable
              style={{
                backgroundColor: isDarkColorScheme
                  ? 'rgba(107, 114, 128, 1)'
                  : 'rgba(156, 163, 175, 1)',
                borderRadius: 22,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isDarkColorScheme
                  ? '0px 4px 12px rgba(0, 0, 0, 0.4)'
                  : '0px 4px 12px rgba(0, 0, 0, 0.15)',
                elevation: 8,
              }}
              // @ts-ignore - web only hover styles
              onMouseEnter={(e: any) => {
                if (Platform.OS === 'web') {
                  e.currentTarget.style.transition = 'transform 0.2s ease'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e: any) => {
                if (Platform.OS === 'web') {
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              <EllipsisHorizontalOutline
                width={24}
                height={24}
                stroke="white"
                strokeWidth={2}
              />
            </Pressable>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="end">
            <View className="flex-col gap-6">
              <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800">
                <UpvoteButton
                  contestId={contestId}
                  variant="compact"
                  showCount={true}
                  className="justify-start"
                  initialCount={initialUpvoteCount}
                />
              </View>
              <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800">
                <SaveButton
                  contestId={contestId}
                  variant="compact"
                  showText={true}
                  className="justify-start"
                  receiptCount={receiptCount}
                  onManageReceipts={onManageReceipts}
                  contestTitle={contestTitle}
                />
              </View>
              <View className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800">
                <ShareButton
                  contestId={contestSlug}
                  contestTitle={contestTitle}
                  language={language}
                  variant="compact"
                  className="justify-start"
                />
              </View>
            </View>
          </PopoverContent>
        </Popover>
      </View>
    </>
  )
}
