'use client'

import { useEffect, useRef } from 'react'

type AdFormat = 'auto' | 'horizontal' | 'vertical' | 'rectangle'

interface AdBannerProps {
  /**
   * Your Google AdSense publisher ID (e.g., "ca-pub-XXXXXXXXXXXXXXXX")
   * Get this from your AdSense dashboard
   */
  publisherId: string
  /**
   * The ad slot ID for this specific ad unit
   * Create ad units in your AdSense dashboard
   */
  slotId: string
  /**
   * Ad format type
   * - 'auto': Automatically sizes based on container
   * - 'horizontal': Banner-style horizontal ad
   * - 'vertical': Skyscraper-style vertical ad
   * - 'rectangle': Square/rectangle ad
   */
  format?: AdFormat
  /**
   * Enable responsive sizing (recommended)
   */
  fullWidthResponsive?: boolean
  /**
   * Enable test mode (use during development)
   * When true, clicks won't be charged and won't violate policies
   */
  testMode?: boolean
  /**
   * Additional CSS class names
   */
  className?: string
  /**
   * Container style
   */
  style?: React.CSSProperties
}

declare global {
  interface Window {
    adsbygoogle: any[]
  }
}

/**
 * Google AdSense Banner Component (Web Only)
 *
 * Prerequisites:
 * 1. Add GoogleAdSense script to your layout.tsx using @next/third-parties
 * 2. Have an approved AdSense account
 * 3. Create ad units in your AdSense dashboard
 *
 * Usage:
 * ```tsx
 * <AdBanner
 *   publisherId="ca-pub-XXXXXXXXXXXXXXXX"
 *   slotId="1234567890"
 *   format="horizontal"
 *   testMode={process.env.NODE_ENV === 'development'}
 * />
 * ```
 */
export function AdBanner({
  publisherId,
  slotId,
  format = 'auto',
  fullWidthResponsive = true,
  testMode = false,
  className = '',
  style,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const isAdLoaded = useRef(false)

  useEffect(() => {
    // Prevent double-loading ads
    if (isAdLoaded.current) return

    // Check if adsbygoogle is available
    if (typeof window !== 'undefined' && window.adsbygoogle) {
      try {
        // Push ad request
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        isAdLoaded.current = true
      } catch (error) {
        console.error('AdSense error:', error)
      }
    }
  }, [])

  return (
    <div
      className={`ad-banner-container ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        minHeight: 90, // Minimum height for horizontal banner
        overflow: 'hidden',
        ...style,
      }}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          height: format === 'horizontal' ? 90 : 'auto',
        }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
        {...(testMode && { 'data-adtest': 'on' })}
      />
    </div>
  )
}

/**
 * Placeholder component for development/testing when AdSense isn't set up
 * Shows a visual placeholder that mimics an ad banner
 */
export function AdBannerPlaceholder({
  className = '',
  style,
  height = 90,
}: {
  className?: string
  style?: React.CSSProperties
  height?: number
}) {
  return (
    <div
      className={`ad-banner-placeholder ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height,
        backgroundColor: '#f0f0f0',
        border: '2px dashed #ccc',
        borderRadius: 8,
        color: '#888',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        ...style,
      }}
    >
      <span>📢 Ad Space - Google AdSense</span>
    </div>
  )
}

export default AdBanner

