import { Stack } from 'expo-router'

const ContestItemStackLayout = () => {
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

export default ContestItemStackLayout
