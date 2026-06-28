import { View, Platform } from 'react-native'

import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { useRouter } from 'app/lib/router-universal'
import { ContinueWithGoogle } from './components/ContinueWithGoogle'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'

export default function SignInRegisterScreen({
  redirectPath = '/',
}: {
  redirectPath?: string
}) {
  const router = useRouter()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)

  return (
    <View className="flex-1 items-center justify-center dark:bg-black bg-white gap-6">
      <Text className="font-bold text-center">
        Sign In / Register with Google
      </Text>
      <ContinueWithGoogle redirectPath={redirectPath} />
      <Button variant="ghost" onPress={() => router.back()}>
        <Text
          className={Platform.OS === 'web' ? 'text-main' : ''}
          style={Platform.OS === 'web' ? undefined : { color: main }}
        >
          Go back
        </Text>
      </Button>
    </View>
  )
}
