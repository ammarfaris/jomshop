import React, { useCallback, useState, useEffect } from 'react'
import {
  View,
  Modal,
  StatusBar,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Gallery } from 'react-native-zoom-toolkit'
import { ImageGalleryProps } from './ImageGallery'
import { Text } from 'app/components/ui/text'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'

export const ImageGalleryNative: React.FC<ImageGalleryProps> = ({
  images,
  initialIndex = 0,
  onClose,
  isVisible = false,
}) => {
  const { top } = useSafeArea()
  const { width, height } = useWindowDimensions()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Wrap setCurrentIndex to avoid Reanimated warnings
  const handleIndexChange = useCallback((index: number) => {
    // Use requestAnimationFrame to defer state update outside of Reanimated's render cycle
    requestAnimationFrame(() => {
      setCurrentIndex(index)
    })
  }, [])

  // Safe close handler to prevent crashes
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])


  // Reset current index when modal opens
  useEffect(() => {
    if (isVisible) {
      setCurrentIndex(initialIndex)
    }
  }, [isVisible, initialIndex])

  const renderItem = useCallback(
    (_uri: string, index: number) => {
      try {
        // Get the corresponding image data to extract authentication info
        const imageData = images[index]
        if (!imageData) {
          return <View style={{ width, height, backgroundColor: 'black' }} />
        }

        // Contest gallery images are public URLs on Supabase.
        const source: any = { uri: imageData.uri }

        // Calculate proper image size for zoom functionality
        // The image should fill the container but maintain aspect ratio
        return (
          <View
            style={{
              width,
              height,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ExpoImage
              source={source}
              style={{
                width: '100%',
                height: '100%',
              }}
              contentFit="contain"
              onError={() => {
                /* swallow errors silently */
              }}
            />
          </View>
        )
      } catch (error) {
        console.log('Error in renderItem:', error)
        return <View style={{ width, height, backgroundColor: 'black' }} />
      }
    },
    [width, height, images]
  )

  // Memoize the data array to prevent Gallery re-renders
  const galleryData = React.useMemo(
    () => images.map((img) => img.uri),
    [images]
  )

  const keyExtractor = useCallback((item: string, index: number) => {
    return `${item}-${index}`
  }, [])

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
        {Platform.OS === 'ios' && (
          <StatusBar barStyle="light-content" backgroundColor="black" />
        )}

        {/* Close button */}
        <View
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? top + 10 : 40,
            right: 20,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => ({
              padding: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
              ✕
            </Text>
          </Pressable>
        </View>

        {/* Image counter */}
        <View
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? top + 15 : 45,
            left: 20,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 15,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: 'white', fontSize: 14 }}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        <Gallery
          data={galleryData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          initialIndex={initialIndex}
          onIndexChange={handleIndexChange}
          onTap={handleClose}
          maxScale={Platform.OS === 'ios' ? 3 : 5} // Reduce max scale on iOS to prevent memory issues
          // Disable vertical pull on both platforms to avoid crashes
          onVerticalPull={undefined}
          zoomEnabled={true}
          allowPinchPanning={true}
          pinchMode="free"
          scaleMode="bounce"
        />
      </GestureHandlerRootView>
    </Modal>
  )
}
