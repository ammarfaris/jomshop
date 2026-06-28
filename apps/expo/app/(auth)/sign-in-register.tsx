import SignInRegisterScreen from 'app/features/auth/sign-in-register-screen'
import { Stack, useLocalSearchParams } from 'expo-router'

export default function Screen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()

  return (
    <>
      {/* This Stack.Screen setup is needed here so that _layout.tsx will show the Title intended (else will show "sign-in" as title) */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SignInRegisterScreen redirectPath={redirect || '/'} />
    </>
  )
}
