import React from 'react'
import { View, Pressable, Platform } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Text } from 'app/components/ui/text'
import { Trans } from '@lingui/react/macro'

interface GalleryThumbnailProps {
  source: any
  blurhash?: string
  index: number
  total: number
  onPress: () => void
  width: number
  height: number
}

export const GalleryThumbnail: React.FC<GalleryThumbnailProps> = ({
  source,
  blurhash,
  index,
  total,
  onPress,
  width,
  height,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
        elevation: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <ExpoImage
        source={source}
        style={{ width, height, borderRadius: 16 }}
        contentFit="cover"
        placeholder={blurhash ? { blurhash } : undefined}
      />

      {/* Gradient overlay */}
      <View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '15%',
          },
          Platform.OS === 'web'
            ? ({
                background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
              } as any)
            : { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
        ]}
      />

      {/* Image counter */}
      <View
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text className="text-white text-xs font-semibold">
          {index + 1} / {total}
        </Text>
      </View>
      {/* Tap hint */}
      <View
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text className="text-white text-xs font-semibold">
          <Trans>TAP TO ZOOM</Trans>
        </Text>
      </View>
    </Pressable>
  )
}
