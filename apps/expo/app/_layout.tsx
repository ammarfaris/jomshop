import '../global.css'

// Configure Reanimated logger to suppress strict mode warnings
// This is necessary because some third-party libraries (like react-native-zoom-toolkit)
// initialize shared values during render, which triggers warnings in strict mode
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated'

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Disable strict mode warnings
})

// polyfill following js-lingui react native example
import '@formatjs/intl-locale/polyfill-force'

import '@formatjs/intl-pluralrules/polyfill-force'
import '@formatjs/intl-pluralrules/locale-data/en' // locale-data for en
import '@formatjs/intl-pluralrules/locale-data/ms' // locale-data for ms

import {
  Theme,
  ThemeProvider,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform, StatusBar as RNStatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler' // we need another root because we are using a modal here
import { PortalHost } from '@rn-primitives/portal' // for rnr Alert Dialog and other (https://reactnativereusables.com/components/alert-dialog/)

import { Provider } from 'app/provider'
import { NAV_THEME } from 'app/utils/constants/ConstNavThemeColors'
import { useColorScheme } from 'app/hooks/useColorScheme'

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
}
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export default function RootLayout() {
  const { isDarkColorScheme } = useColorScheme()

  // Paints the window behind the status bar / home-indicator safe areas so the
  // theme background extends edge-to-edge. Matches the `bg-black`/`bg-white`
  // the screens use for their bodies so there is no seam at the bars.
  const rootBackgroundColor = isDarkColorScheme ? '#000000' : '#ffffff'

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(false)
      RNStatusBar.setBackgroundColor(
        isDarkColorScheme ? '#000000' : '#ffffff',
        false,
      )
      RNStatusBar.setBarStyle(
        isDarkColorScheme ? 'light-content' : 'dark-content',
        false,
      )
    }
  }, [isDarkColorScheme])

  const screens = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: rootBackgroundColor },
        headerTintColor: isDarkColorScheme ? '#ffffff' : '#000000',
        headerTitleStyle: { color: isDarkColorScheme ? '#ffffff' : '#000000' },
        contentStyle: { backgroundColor: rootBackgroundColor },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ title: '', headerShown: false }} />
      <Stack.Screen name="user" options={{ title: '', headerShown: false }} />
      <Stack.Screen
        name="contest"
        options={{
          title: 'Contest Details',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          title: 'About Us',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="contact"
        options={{
          title: 'Contact Us',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: 'Privacy Policy',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          title: 'Terms & Conditions',
          headerShown: true,
        }}
      />
    </Stack>
  )

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: rootBackgroundColor }}
    >
      <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
        <Provider>
          <StatusBar
            style={isDarkColorScheme ? 'light' : 'dark'}
            animated={true}
          />
          {Platform.OS === 'web' ? (
            screens
          ) : (
            <>
              {screens}
              <PortalHost />
            </>
          )}
        </Provider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
