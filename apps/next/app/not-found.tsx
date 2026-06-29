'use client'

import { useState, useEffect } from 'react'
import { View } from 'react-native'

import { useRouter } from 'app/lib/router-universal'
import { Text } from 'app/components/ui/text'
import { ButtonIconAndText } from 'app/components/ButtonIconAndText'
import { HomeOutline } from 'app/components/icons-svg/HomeOutline'
import { BACKEND } from 'app/lib/backend'

export default function NotFound() {
  const router = useRouter()
  const [currentLocale, setCurrentLocale] = useState<'en' | 'ms'>('en')

  useEffect(() => {
    // Load locale preference on client side only
    const loadLocale = async () => {
      if (BACKEND !== 'appwrite') {
        setCurrentLocale('en')
        return
      }

      try {
        const { account } = await import('app/provider/appwrite/api')
        const prefs = await account.getPrefs()
        const lang = (prefs as { language?: string })?.language || 'en'
        setCurrentLocale(lang === 'ms' ? 'ms' : 'en')
      } catch {
        // Default to 'en' if there's an error
        setCurrentLocale('en')
      }
    }

    loadLocale()
  }, [])

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <View className="min-h-screen justify-center items-center dark:bg-black bg-white px-4 pt-16">
      <View className="max-w-md w-full text-center">
        <Text className="text-6xl font-bold text-main mb-4 text-center">
          404
        </Text>
        <Text className="text-xl font-semibold mb-2 text-center">
          {currentLocale === 'ms' ? 'Halaman Tidak Dijumpai' : 'Page Not Found'}
        </Text>
        <Text className="text-muted-foreground mb-6 text-center">
          {currentLocale === 'ms'
            ? 'Maaf, kami tidak dapat mencari halaman yang anda cari.'
            : "Sorry, we couldn't find the page you're looking for."}
        </Text>
        <ButtonIconAndText
          onPress={handleGoHome}
          buttonClassName="mx-auto"
          buttonText={
            currentLocale === 'ms' ? 'Pergi ke Laman Utama' : 'Go Home'
          }
          Icon={HomeOutline}
          iconSize={20}
          iconColorInverted={false}
        />
      </View>
    </View>
  )
}
