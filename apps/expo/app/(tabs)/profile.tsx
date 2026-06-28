import { Stack } from 'expo-router'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import ProfileScreen from 'app/features/profile/screen'

export default function Profile() {
  return (
    <>
      <Stack.Screen
        options={{
          title: i18n._(msg`Profile`),
        }}
      />
      <ProfileScreen />
    </>
  )
}
