import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { ImageGalleryProps } from './ImageGallery'

// Client-side only imports
let Lightbox: any
let Zoom: any
let Captions: any

export const ImageGalleryWeb: React.FC<ImageGalleryProps> = ({
  images,
  initialIndex = 0,
  onClose,
  isVisible = false,
}) => {
  const { isDarkColorScheme } = useColorScheme()
  const isDarkMode = isDarkColorScheme
  const [mounted, setMounted] = useState(false)
  const [componentsLoaded, setComponentsLoaded] = useState(false)
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  )

  // Lock body scroll on web when gallery is visible (especially for iOS Safari)
  useEffect(() => {
    if (Platform.OS === 'web' && isVisible && typeof window !== 'undefined') {
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY

      // Save scroll position for later restoration
      setScrollPosition(scrollY)

      // Prevent scrolling with iOS Safari fix
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      // Restore original styles when gallery closes
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [isVisible])

  // No controlled index state

  useEffect(() => {
    setMounted(true)

    if (typeof window !== 'undefined') {
      const loadComponents = async () => {
        try {
          const [lightboxModule, zoomModule, captionsModule] =
            await Promise.all([
              import('yet-another-react-lightbox'),
              import('yet-another-react-lightbox/plugins/zoom'),
              import('yet-another-react-lightbox/plugins/captions'),
            ])

          Lightbox = lightboxModule.default
          Zoom = zoomModule.default
          Captions = captionsModule.default
          setComponentsLoaded(true)

          // Load styles dynamically
          if (
            !document.querySelector('link[href*="yet-another-react-lightbox"]')
          ) {
            const lightboxStyles = document.createElement('link')
            lightboxStyles.rel = 'stylesheet'
            lightboxStyles.href =
              'https://unpkg.com/yet-another-react-lightbox@3.21.3/styles.css'
            document.head.appendChild(lightboxStyles)

            const captionStyles = document.createElement('link')
            captionStyles.rel = 'stylesheet'
            captionStyles.href =
              'https://unpkg.com/yet-another-react-lightbox@3.21.3/plugins/captions.css'
            document.head.appendChild(captionStyles)
          }
        } catch (error) {
          console.error('Failed to load lightbox components:', error)
        }
      }

      loadComponents()
      // Track viewport width to match modal close button sizing
      const handleResize = () => {
        setIsMobileDevice(window.innerWidth < 1024)
      }
      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  // Don't render anything on server side or before components are loaded
  if (!mounted || !componentsLoaded || Platform.OS !== 'web' || !Lightbox) {
    return null
  }

  const slides = images.map((image, index) => ({
    key: image.id || image.uri || String(index),
    src: image.uri,
    alt: image.title || '',
    // No title to avoid showing it in captions bar
    title: undefined as unknown as string | undefined,
    // Always show only "Image x of y"
    description: `Image ${index + 1} of ${images.length}`,
  }))

  // Enhanced close handler that preserves scroll position without touching body styles
  const handleClose = () => {
    if (onClose) {
      onClose()
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const y = scrollPosition
      // Defer to the next tick to allow the lightbox to finish unmounting and
      // then restore our desired scroll position.
      setTimeout(() => {
        try {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' })
        } catch {}
      }, 0)
    }
  }

  return (
    <Lightbox
      open={isVisible}
      close={handleClose}
      slides={slides}
      index={initialIndex}
      plugins={[Zoom, Captions]}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      captions={{
        showToggle: false,
        descriptionTextAlign: 'center',
      }}
      carousel={{
        finite: true,
        preload: 2,
        padding: '16px',
        spacing: 0,
        imageFit: 'contain',
      }}
      render={{
        // Remove navigation arrows entirely
        buttonPrev: () => null,
        buttonNext: () => null,
        // Hide zoom +/- buttons entirely while keeping gesture zoom
        buttonZoom: () => null,
        // Custom close button
        buttonClose: () => (
          <button
            key="lightbox-close"
            onClick={handleClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: isMobileDevice ? 16 : 28,
              right: isMobileDevice ? 16 : 30,
              zIndex: 1001,
              backgroundColor: isDarkMode
                ? 'rgba(107, 114, 128, 1)'
                : 'rgba(156, 163, 175, 1)',
              border: 'none',
              borderRadius: '50%',
              width: isMobileDevice ? 40 : 44,
              height: isMobileDevice ? 40 : 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 18,
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              boxShadow: isDarkMode
                ? '0 4px 12px rgba(0,0,0,0.4)'
                : '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? 'rgba(75, 85, 99, 1)'
                : 'rgba(107, 114, 128, 1)'
              e.currentTarget.style.transform = 'scale(1.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? 'rgba(107, 114, 128, 1)'
                : 'rgba(156, 163, 175, 1)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕
          </button>
        ),
      }}
      styles={{
        container: {
          backgroundColor: isDarkMode
            ? 'rgba(0, 0, 0, 1)'
            : 'rgba(255, 255, 255, 1)',
          // Ensure full viewport coverage on iOS Safari
          minHeight: '100dvh', // Use dynamic viewport height for better mobile support
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        toolbar: {
          backgroundColor: 'transparent',
          backdropFilter: 'none',
          color: isDarkMode ? '#fff' : '#111',
          boxShadow: 'none',
        },
        // Ensure all icons (close, zoom, etc.) have sufficient contrast
        icon: {
          color: isDarkMode ? '#ffffff' : '#111111',
        },
        footer: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
        },
        // Hide nav backgrounds (no arrows rendered)
        navigationPrev: { display: 'none' },
        navigationNext: { display: 'none' },
      }}
      animation={{
        fade: 250,
        swipe: 500,
      }}
      controller={{
        closeOnPullDown: true,
        closeOnBackdropClick: true,
      }}
      // We manage scroll locking ourselves above for better iOS Safari support
      noScroll={{ disabled: true } as any}
    />
  )
}
