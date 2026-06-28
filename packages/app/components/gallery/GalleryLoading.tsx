import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Text } from 'app/components/ui/text'

interface GalleryLoadingProps {
  message?: string
}

export const GalleryLoading: React.FC<GalleryLoadingProps> = ({
  message = 'Loading gallery...',
}) => {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <ActivityIndicator size="large" color="#fff" />
      <Text style={{ color: 'white', marginTop: 16, fontSize: 16 }}>
        {message}
      </Text>
    </View>
  )
}
