import { View, Pressable } from 'react-native'

import { Text } from 'app/components/ui/text'
import { useRouter } from 'app/lib/router-universal'
import { useRouteParams } from 'app/hooks/useRouteParams'

const useUserParams = useRouteParams<{ id: string }>

export default function UserDetailScreen() {
  const { id = '' } = useUserParams()
  const router = useRouter()

  return (
    <View className="flex-1 justify-center items-center gap-8 dark:bg-black bg-white">
      <Text className="text-black dark:text-white">
        Hi {id.charAt(0).toUpperCase() + id.slice(1)} 👋🏻
      </Text>
      <Pressable onPress={() => router.back()}>
        <Text className="text-black dark:text-white">👈 Go Back</Text>
      </Pressable>
    </View>
  )
}
