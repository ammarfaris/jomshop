import { useState, useMemo } from 'react'
import { Pressable, Platform, Share as RNShare } from 'react-native'
import { useLingui } from '@lingui/react/macro'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { Text } from 'app/components/ui/text'
import { ShareOutline } from 'app/components/icons-svg/ShareOutline'
import { cn } from 'app/lib/utils'
import { toast } from 'app/lib/sonner-universal'
import { generateShareContent } from 'app/utils/share'
import { ShareModal } from 'app/components/ShareModal.web'

export interface ShareButtonProps {
  contestId: string
  contestTitle: string
  language: 'en' | 'ms'
  variant?: 'default' | 'icon-only' | 'compact'
  className?: string
  onShareComplete?: () => void
  onShareError?: (error: Error) => void
}

export function ShareButton({
  contestId,
  contestTitle,
  language,
  variant = 'default',
  className,
  onShareComplete,
  onShareError,
}: ShareButtonProps) {
  const { t } = useLingui()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const inactiveNativeColor = isDarkColorScheme ? '#9ca3af' : '#4b5563'
  const [isSharing, setIsSharing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [justShared, setJustShared] = useState(false)

  // Memoize share content generation for performance
  const shareContent = useMemo(
    () => generateShareContent({ contestId, contestTitle, language }),
    [contestId, contestTitle, language]
  )

  // Platform detection
  const canUseNativeShare = Platform.OS === 'ios' || Platform.OS === 'android'

  // Web Share API detection (only on web)
  const canUseWebShare =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ url: shareContent.url })

  // Handle native share (iOS/Android)
  const handleNativeShare = async () => {
    try {
      setIsSharing(true)
      await RNShare.share({
        title: shareContent.title,
        message: `${shareContent.message}\n${shareContent.url}`,
      })
      setJustShared(true)
      onShareComplete?.()
    } catch (error) {
      // User dismissed the share dialog - this is not an error
      if (
        error instanceof Error &&
        error.message !== 'User did not share' &&
        !error.message.includes('cancelled')
      ) {
        console.error('Native share failed:', error)
        onShareError?.(error)
        toast.error(i18n._(msg`Failed to share. Please try again`))
      }
    } finally {
      setIsSharing(false)
    }
  }

  // Handle Web Share API
  const handleWebShare = async () => {
    try {
      setIsSharing(true)
      await navigator.share({
        title: shareContent.title,
        text: shareContent.message,
        url: shareContent.url,
      })
      setJustShared(true)
      onShareComplete?.()
    } catch (error) {
      // AbortError means user cancelled - this is not an error
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Web share failed:', error)
        // Fallback to modal
        setShowModal(true)
      }
    } finally {
      setIsSharing(false)
    }
  }

  // Handle fallback modal (web without Web Share API)
  const handleFallbackShare = () => {
    setShowModal(true)
    setJustShared(true)
  }

  // Main share handler
  const handleShare = () => {
    if (canUseNativeShare) {
      handleNativeShare()
    } else if (canUseWebShare) {
      handleWebShare()
    } else {
      handleFallbackShare()
    }
  }

  // Variant-specific styles
  const iconSize = variant === 'icon-only' ? 'w-5 h-5' : 'w-5 h-5'
  const showText = variant !== 'icon-only'

  return (
    <>
      <Pressable
        onPress={handleShare}
        disabled={isSharing}
        className={cn(
          'flex-row items-center justify-center gap-1 rounded-full transition-all',
          variant === 'icon-only'
            ? 'px-2 py-1'
            : variant === 'compact'
            ? 'px-2 py-1'
            : 'px-3 py-1.5',
          isSharing && 'opacity-50',
          Platform.OS === 'web' && 'hover:scale-105 active:scale-95',
          className
        )}
        style={({ pressed }) => ({
          opacity: Platform.OS !== 'web' && pressed ? 0.7 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={t`Share contest`}
        accessibilityHint={t`Opens share dialog to share this contest`}
      >
        {/* Icon */}
        <ShareOutline
          className={cn(
            iconSize,
            justShared
              ? Platform.OS === 'web'
                ? 'text-main'
                : ''
              : 'text-gray-600 dark:text-gray-400'
          )}
          width={20}
          height={20}
          color={
            Platform.OS !== 'web'
              ? justShared
                ? main
                : inactiveNativeColor
              : undefined
          }
          accessibilityLabel="Share icon"
        />

        {/* Label */}
        {showText && (
          <Text
            className={cn(
              'font-medium text-sm',
              justShared
                ? Platform.OS === 'web'
                  ? 'text-main'
                  : ''
                : 'text-gray-700 dark:text-gray-300'
            )}
            style={
              Platform.OS !== 'web'
                ? { color: justShared ? main : inactiveNativeColor }
                : undefined
            }
          >
            <Trans>Share</Trans>
          </Text>
        )}
      </Pressable>

      {/* ShareModal for web fallback */}
      {showModal && Platform.OS === 'web' && (
        <ShareModal
          isOpen={showModal}
          shareContent={shareContent}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
