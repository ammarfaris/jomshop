import { useState, useEffect } from 'react'
import { Platform, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  CONTEST_HOSTS_BUCKET_ID,
} from 'app/provider/appwrite/constants'
import { storage } from 'app/provider/appwrite/api'

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
 * HostImage component that properly handles SVG and raster images across platforms.
 *
 * Key differences:
 * - On web: Uses /download endpoint for better SVG support
 * - On web mobile: Applies 4x rendering for SVG files (auto-detected from Appwrite Storage) to ensure crisp display
 * - On iOS/Android: Uses /view endpoint with token auth
 * - Handles JWT authentication for Android when needed
 * - Automatically fetches MIME type from Appwrite Storage for SVG detection
 */
export function HostImage({
  imgId,
  imgTokenSecret,
  imgBlurhash,
  width,
  height,
  borderRadius = 6,
  contentFit = 'contain',
  style,
  jwt,
}: HostImageProps) {
  const [fetchedMimeType, setFetchedMimeType] = useState<string | null>(null)

  // Fetch MIME type from storage
  useEffect(() => {
    if (!imgId) return

    const fetchMimeType = async () => {
      try {
        // Try to get file metadata from Appwrite Storage
        const fileInfo = await storage.getFile({
          bucketId: CONTEST_HOSTS_BUCKET_ID,
          fileId: imgId,
        })
        if (fileInfo?.mimeType) {
          setFetchedMimeType(fileInfo.mimeType)
        }
      } catch (error) {
        console.warn('Failed to fetch file MIME type:', error)
      }
    }

    fetchMimeType()
  }, [imgId])

  const baseUri = `${APPWRITE_ENDPOINT}/storage/buckets/${CONTEST_HOSTS_BUCKET_ID}/files/${imgId}`

  // Build the image source with platform-specific handling
  const source = (() => {
    const src: any = {}

    if (Platform.OS === 'web') {
      // On web, use /download endpoint which properly serves SVGs with correct Content-Type
      // and allows cross-origin access. Fall back to token auth.
      src.uri = `${baseUri}/download?project=${APPWRITE_PROJECT_ID}${
        imgTokenSecret ? `&token=${imgTokenSecret}` : ''
      }`
    } else if (Platform.OS === 'android' && jwt && !imgTokenSecret) {
      // Android + no token: fall back to JWT header authentication.
      // Only used for private host images that have no token_secret.
      // NOTE: &_jwt=1 makes the URL distinct from any prior unauthenticated attempt
      // so Glide (expo-image's Android cache backend) doesn't serve a cached 401.
      src.uri = `${baseUri}/view?project=${APPWRITE_PROJECT_ID}&_jwt=1`
      src.headers = { 'X-Appwrite-JWT': jwt }
    } else {
      // iOS/Android without JWT: Use token in URL
      src.uri = `${baseUri}/view?project=${APPWRITE_PROJECT_ID}${
        imgTokenSecret ? `&token=${imgTokenSecret}` : ''
      }`
    }

    return src
  })()

  // Use fetched MIME type
  const mimeType = fetchedMimeType

  // For web: Apply 4x rendering trick ONLY for SVG files on mobile browsers
  // Desktop browsers already render SVGs sharply, so no need for the overhead
  if (Platform.OS === 'web') {
    // Detect if this is an SVG file (check MIME type first, then fallback to filename)
    const isSvgFile =
      mimeType === 'image/svg+xml' || imgId.toLowerCase().includes('.svg')

    // Detect mobile browser (simple check)
    const isMobileBrowser =
      typeof window !== 'undefined' &&
      /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)

    // Use 4x rendering only for SVG files on mobile browsers, 1x for everything else
    const renderScale = isSvgFile && isMobileBrowser ? 4 : 1

    // If desktop (renderScale = 1), render normally without wrapper
    if (renderScale === 1) {
      return (
        <ExpoImage
          source={source}
          style={[
            {
              width,
              height,
              borderRadius,
            },
            style,
          ]}
          contentFit={contentFit}
          placeholder={{
            blurhash: imgBlurhash || DEFAULT_BLURHASH,
          }}
          cachePolicy="memory-disk"
          transition={200}
        />
      )
    }

    // Mobile browser: Use 4x rendering with scale-down trick
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius,
            overflow: 'hidden',
          },
          style,
        ]}
      >
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
          placeholder={{
            blurhash: imgBlurhash || DEFAULT_BLURHASH,
          }}
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>
    )
  }

  // Native: Render normally
  return (
    <ExpoImage
      source={source}
      style={[
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
      contentFit={contentFit}
      placeholder={{
        blurhash: imgBlurhash || DEFAULT_BLURHASH,
      }}
      cachePolicy="memory-disk"
      transition={200}
    />
  )
}
