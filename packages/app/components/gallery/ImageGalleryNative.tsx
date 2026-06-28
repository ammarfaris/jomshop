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
import { account } from 'app/provider/appwrite/api'

export const ImageGalleryNative: React.FC<ImageGalleryProps> = ({
  images,
  initialIndex = 0,
  onClose,
  isVisible = false,
}) => {
  const { top } = useSafeArea()
  const { width, height } = useWindowDimensions()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // JWT for Android authentication (same as ContestsListScreen)
  const [jwt, setJwt] = useState<string | null>(null)
  const [jwtReady, setJwtReady] = useState<boolean>(Platform.OS !== 'android')

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

  useEffect(() => {
    if (Platform.OS === 'android') {
      const fetchJWT = async () => {
        try {
          const { jwt } = await account.createJWT()
          setJwt(jwt)
          setJwtReady(true)
          // console.log('JWT fetched successfully for gallery')
        } catch (error) {
          console.log('Failed to create JWT:', error)
          setJwtReady(true) // Still mark as ready to prevent infinite loading
        }
      }
      // Fetch JWT immediately when component mounts
      fetchJWT()
    }
  }, [])

  const renderItem = useCallback(
    (_uri: string, index: number) => {
      try {
        // Get the corresponding image data to extract authentication info
        const imageData = images[index]
        if (!imageData) {
          return <View style={{ width, height, backgroundColor: 'black' }} />
        }

        // Build source object similar to ContestsListScreen logic
        let source: any = { uri: imageData.uri }

        if (Platform.OS === 'android') {
          const hasTokenInUri = imageData.uri.includes('token=')

          if (jwt) {
            // Strip token parameter safely when using JWT headers
            const uriWithoutToken = imageData.uri.replace(
              /([&?])token=[^&]+/,
              ''
            )
            source.uri = uriWithoutToken
            source.headers = { 'X-Appwrite-JWT': jwt }
            // no console on prod
          } else if (!jwtReady && hasTokenInUri) {
            // No JWT yet, keep token in URI so image can still load
            // no console on prod
          }
        }

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
    [width, height, images, jwt, jwtReady]
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

        {/* Show loading indicator for Android while JWT is being fetched */}
        {Platform.OS === 'android' && !jwtReady && (
          <View
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: [{ translateX: -20 }, { translateY: -20 }],
              zIndex: 1001,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              Loading authentication...
            </Text>
          </View>
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
