'use client'

import { View } from 'react-native'

import { useRouter } from 'app/lib/router-universal'
import { Text } from 'app/components/ui/text'
import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { HomeOutline } from 'app/components/icons-svg/HomeOutline'

export default function NotFound() {
  const router = useRouter()

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <View className="min-h-screen justify-center items-center dark:bg-black bg-white px-4 pt-16">
      <View className="max-w-md w-full text-center">
        <Text className="text-6xl font-bold text-main mb-4 text-center">
          404
        </Text>
        {/* Bilingual copy: a 404 has no reliable locale signal (no auth/profile),
            so we serve English + Bahasa Malaysia rather than English-only. */}
        <Text className="text-xl font-semibold mb-1 text-center">
          Page Not Found
        </Text>
        <Text className="text-lg font-semibold mb-4 text-center text-muted-foreground">
          Halaman Tidak Dijumpai
        </Text>
        <Text className="text-muted-foreground mb-1 text-center">
          Sorry, we couldn't find the page you're looking for.
        </Text>
        <Text className="text-muted-foreground mb-6 text-center">
          Maaf, kami tidak dapat mencari halaman yang anda cari.
        </Text>
        <ButtonIconAndText
          onPress={handleGoHome}
          buttonClassName="mx-auto"
          buttonText="Go Home"
          Icon={HomeOutline}
          iconSize={20}
          iconColorInverted={false}
        />
      </View>
    </View>
  )
}
