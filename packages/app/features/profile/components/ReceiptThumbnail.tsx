import { View, Pressable, Platform, ActivityIndicator } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Text } from 'app/components/ui/text'
import { cn } from 'app/lib/utils'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import type { Receipt } from 'app/lib/receipts/api'
import { getReceiptFileUrl } from 'app/lib/receipts/api'
import { BACKEND } from 'app/lib/backend'
import { isImageFile, isPDFFile } from 'app/utils/filePicker'
import { Trans } from '@lingui/react/macro'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import { PencilOutline } from 'app/components/icons-svg/PencilOutline'

interface ReceiptThumbnailProps {
  receipt: Receipt
  jwt?: string | null
  /** Pre-resolved display URL (Supabase signed URL). Falls back to Appwrite view URL. */
  imageUrl?: string
  onPress?: () => void
  onDelete?: () => void
  onEdit?: () => void
  className?: string
}

/**
 * ReceiptThumbnail component
 * Displays a thumbnail preview of a receipt (image or PDF icon)
 */
export function ReceiptThumbnail({
  receipt,
  jwt,
  imageUrl,
  onPress,
  onDelete,
  onEdit,
  className,
}: ReceiptThumbnailProps) {
  const { colorTheme } = useColorTheme()
  const isImage = isImageFile(receipt.file_type)
  const isPDF = isPDFFile(receipt.file_type)
  
  // Helper function to get theme-aware background class for edit button
  const getEditButtonClass = () => {
    if (Platform.OS === 'web') {
      return 'bg-main'
    }
    // On native, use hardcoded color classes
    return colorTheme === 'blue' ? 'bg-blue-500' : 'bg-green-600'
  }

  // Build image source for images.
  // Supabase passes a ready signed URL via `imageUrl`; Appwrite computes a view
  // URL (+ JWT header on Android for private-file auth).
  const imageSource = isImage
    ? (() => {
        const baseUri =
          imageUrl ??
          (BACKEND === 'appwrite' ? getReceiptFileUrl(receipt.file_id) : '')
        const src: any = { uri: baseUri }

        if (BACKEND === 'appwrite' && Platform.OS === 'android' && jwt) {
          src.headers = { 'X-Appwrite-JWT': jwt }
        }

        return src
      })()
    : null

  return (
    <View style={{ position: 'relative' }} className={className}>
      <Pressable
        onPress={onPress}
        className={cn(
          'w-full h-32 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800',
          Platform.OS === 'web' &&
            'hover:border-main'
        )}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {isImage && imageSource?.uri ? (
          <ExpoImage
            source={imageSource}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : isImage ? (
          // Signed URL not ready yet (or failed to mint) — show a spinner instead
          // of an empty/broken image tile.
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : isPDF ? (
          <View className="flex-1 items-center justify-center bg-red-50 dark:bg-red-950">
            <Text className="text-4xl mb-2">📄</Text>
            <Text className="text-xs text-red-600 dark:text-red-400 font-medium text-center px-2">
              PDF
            </Text>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-4xl mb-2">📎</Text>
            <Text className="text-xs text-gray-600 dark:text-gray-400 text-center px-2">
              <Trans>File</Trans>
            </Text>
          </View>
        )}
      </Pressable>

      {/* Notes Preview */}
      <View className="mt-2 px-2">
        <Text
          className="text-xs text-gray-600 dark:text-gray-400"
          numberOfLines={2}
        >
          <Trans>Note</Trans> {receipt.file_order + 1}:{' '}
          {receipt.notes && receipt.notes.trim()
            ? receipt.notes
            : <Trans>Click on the edit icon to add note</Trans>}
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="absolute top-2 right-2 flex-row gap-2">
        {onEdit && (
          <Pressable
            onPress={onEdit}
            className={cn(getEditButtonClass(), 'rounded-full p-2 shadow-md')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <PencilOutline className="w-4 h-4 text-white" />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={onDelete}
            className="bg-red-600 rounded-full p-2 shadow-md"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <XMarkOutline className="w-4 h-4 text-white" />
          </Pressable>
        )}
      </View>

      {/* Receipt Order Badge */}
      <View className="absolute top-2 left-2 bg-black/60 dark:bg-white/60 rounded-full px-2 py-1">
        <Text className="text-white dark:text-black text-xs font-bold">
          #{receipt.file_order + 1}
        </Text>
      </View>
    </View>
  )
}
