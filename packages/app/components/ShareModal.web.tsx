import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'app/components/ui/alert-dialog'
import { Button } from 'app/components/ui/button'
import { Text } from 'app/components/ui/text'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import { cn } from 'app/lib/utils'
import { toast } from 'app/lib/sonner-universal'
import { getSocialShareUrl, type ShareContent } from 'app/utils/share'

export interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  shareContent: ShareContent
}

/**
 * ShareModal - Web-only fallback modal for sharing contests
 * Used when the Web Share API is not available
 */
export function ShareModal({ isOpen, onClose, shareContent }: ShareModalProps) {
  const [isCopying, setIsCopying] = useState(false)

  // Handle copy to clipboard
  const handleCopyLink = async () => {
    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(shareContent.url)
      toast.success(i18n._(msg`Link copied to clipboard`))
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error(i18n._(msg`Failed to copy link. Please try again`))
    } finally {
      setIsCopying(false)
    }
  }

  // Handle social share button click
  const handleSocialShare = (
    platform: 'facebook' | 'twitter' | 'whatsapp' | 'telegram'
  ) => {
    try {
      const shareUrl = getSocialShareUrl(platform, shareContent)
      window.open(shareUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error(`Failed to open ${platform} share:`, error)
      toast.error(i18n._(msg`Failed to open share dialog. Please try again`))
    }
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        {/* Header with close button */}
        <AlertDialogHeader>
          <View className="flex-row items-center justify-between">
            <AlertDialogTitle>
              <Trans>Share Contest</Trans>
            </AlertDialogTitle>
            <Pressable
              onPress={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              accessibilityRole="button"
              accessibilityLabel={i18n._(msg`Close share dialog`)}
            >
              <XMarkOutline className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Pressable>
          </View>
        </AlertDialogHeader>

        {/* Content */}
        <View className="flex flex-col gap-4 mt-2">
          {/* Copy Link Button - Primary Action */}
          <Button
            onPress={handleCopyLink}
            disabled={isCopying}
            variant="default"
            className="w-full"
            accessibilityLabel={i18n._(msg`Copy contest link to clipboard`)}
          >
            <Text className="text-primary-foreground font-medium">
              {isCopying ? <Trans>Copying...</Trans> : <Trans>Copy Link</Trans>}
            </Text>
          </Button>

          {/* Divider */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              <Trans>Share via</Trans>
            </Text>
            <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </View>

          {/* Social Share Buttons */}
          <View className="flex-row flex-wrap gap-3 justify-center">
            {/* WhatsApp */}
            <Pressable
              onPress={() => handleSocialShare('whatsapp')}
              className={cn(
                'flex-1 min-w-[120px] flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'bg-[#25D366] hover:bg-[#20BA5A] active:bg-[#1DA851] transition-colors'
              )}
              accessibilityRole="button"
              accessibilityLabel={i18n._(msg`Share on WhatsApp`)}
            >
              <WhatsAppIcon />
              <Text className="text-white font-medium text-sm">WhatsApp</Text>
            </Pressable>

            {/* Facebook */}
            <Pressable
              onPress={() => handleSocialShare('facebook')}
              className={cn(
                'flex-1 min-w-[120px] flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1467D8] transition-colors'
              )}
              accessibilityRole="button"
              accessibilityLabel={i18n._(msg`Share on Facebook`)}
            >
              <FacebookIcon />
              <Text className="text-white font-medium text-sm">Facebook</Text>
            </Pressable>

            {/* Twitter/X */}
            <Pressable
              onPress={() => handleSocialShare('twitter')}
              className={cn(
                'flex-1 min-w-[120px] flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'bg-[#000000] hover:bg-[#1a1a1a] active:bg-[#0d0d0d] transition-colors'
              )}
              accessibilityRole="button"
              accessibilityLabel={i18n._(msg`Share on Twitter`)}
            >
              <TwitterIcon />
              <Text className="text-white font-medium text-sm">Twitter</Text>
            </Pressable>

            {/* Telegram */}
            <Pressable
              onPress={() => handleSocialShare('telegram')}
              className={cn(
                'flex-1 min-w-[120px] flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'bg-[#0088CC] hover:bg-[#007AB8] active:bg-[#006BA3] transition-colors'
              )}
              accessibilityRole="button"
              accessibilityLabel={i18n._(msg`Share on Telegram`)}
            >
              <TelegramIcon />
              <Text className="text-white font-medium text-sm">Telegram</Text>
            </Pressable>
          </View>
        </View>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Simple SVG icon components for social platforms
function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
        fill="white"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="white"
      />
    </svg>
  )
}

function TwitterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill="white"
      />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
        fill="white"
      />
    </svg>
  )
}
