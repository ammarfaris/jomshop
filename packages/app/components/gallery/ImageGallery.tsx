import React from 'react'
import { Platform } from 'react-native'

export interface ImageItem {
  id: string
  uri: string
  tokenSecret?: string
  blurhash?: string
  title?: string
  description?: string
}

export interface ImageGalleryProps {
  images: ImageItem[]
  initialIndex?: number
  onClose?: () => void
  isVisible?: boolean
}

// Dynamic imports to handle platform differences
export const ImageGallery: React.FC<ImageGalleryProps> = (props) => {
  if (Platform.OS === 'web') {
    const { ImageGalleryWeb } = require('./ImageGalleryWeb')
    return <ImageGalleryWeb {...props} />
  }

  const { ImageGalleryNative } = require('./ImageGalleryNative')
  return <ImageGalleryNative {...props} />
}
