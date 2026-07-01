import { Platform, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'

type HostImageProps = {
  imgId: string
  imgTokenSecret?: string | null
  imgBlurhash?: string
  width: number
  height: number
  borderRadius?: number
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  style?: any
  jwt?: string | null
}

const DEFAULT_BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

/**
 * Renders a host logo. On Supabase, host logos are stored as full public URLs
 * (passed in as `imgId`), so this simply loads that URL. On mobile web, SVG
 * logos are rendered at 4x and scaled down so they stay crisp.
 */
export function HostImage({
  imgId,
  imgBlurhash,
  width,
  height,
  borderRadius = 6,
  contentFit = 'contain',
  style,
}: HostImageProps) {
  // No image (e.g. hosts with no logo) — render nothing.
  if (!imgId) return null

  const source = { uri: imgId }

  if (Platform.OS === 'web') {
    const isSvgFile = imgId.toLowerCase().includes('.svg')
    const isMobileBrowser =
      typeof window !== 'undefined' &&
      /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
    const renderScale = isSvgFile && isMobileBrowser ? 4 : 1

    if (renderScale === 1) {
      return (
        <ExpoImage
          source={source}
          style={[{ width, height, borderRadius }, style]}
          contentFit={contentFit}
          placeholder={{ blurhash: imgBlurhash || DEFAULT_BLURHASH }}
          cachePolicy="memory-disk"
          transition={200}
        />
      )
    }

    return (
      <View style={[{ width, height, borderRadius, overflow: 'hidden' }, style]}>
        <ExpoImage
          source={source}
          style={
            {
              width: width * renderScale,
              height: height * renderScale,
              transform: [{ scale: 1 / renderScale }],
              transformOrigin: 'top left',
            } as any
          }
          contentFit={contentFit}
          placeholder={{ blurhash: imgBlurhash || DEFAULT_BLURHASH }}
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>
    )
  }

  return (
    <ExpoImage
      source={source}
      style={[{ width, height, borderRadius }, style]}
      contentFit={contentFit}
      placeholder={{ blurhash: imgBlurhash || DEFAULT_BLURHASH }}
      cachePolicy="memory-disk"
      transition={200}
    />
  )
}
