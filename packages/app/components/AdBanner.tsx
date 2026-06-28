/**
 * AdBanner Default/Native Implementation
 *
 * Shows a placeholder on React Native (iOS/Android).
 * Google AdSense is web-only. For real mobile ads, use Google AdMob
 * with react-native-google-mobile-ads package.
 *
 * Web implementation is in AdBanner.web.tsx
 */

import { View, Text } from 'react-native'

export interface AdBannerProps {
  publisherId: string
  slotId: string
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle'
  fullWidthResponsive?: boolean
  testMode?: boolean
  className?: string
  style?: any
}

export function AdBanner(_props: AdBannerProps) {
  // AdSense is web-only, show placeholder on native
  // TODO: Implement Google AdMob for native ads
  return <AdBannerPlaceholder height={90} />
}

export function AdBannerPlaceholder({
  height = 90,
}: {
  className?: string
  style?: any
  height?: number
}) {
  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: '#f0f0f0',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#ccc',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#888', fontSize: 14 }}>
        📢 Ad Space - Google AdMob
      </Text>
    </View>
  )
}

export default AdBanner
