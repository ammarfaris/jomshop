import { Stack } from 'expo-router'

const UserStackLayout = () => {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  )
}

export default UserStackLayout
