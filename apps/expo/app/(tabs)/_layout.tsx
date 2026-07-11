import { Tabs } from 'expo-router'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { Platform, View, Text, StyleSheet } from 'react-native'
import { Image as ExpoImage } from 'expo-image'

import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { HomeOutline } from 'app/components/icons-svg/HomeOutline'
import { SearchOutline } from 'app/components/icons-svg/SearchOutline'
import { BuildingLibraryOutline } from 'app/components/icons-svg/BuildingLibraryOutline'
import { UserCircleOutline } from 'app/components/icons-svg/UserCircleOutline'
import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { FeedbackDialog } from 'app/components/FeedbackDialog'
import { useAuth } from 'app/contexts/AuthContext'
import { useIsAdmin } from 'app/hooks/useIsAdmin'
import { ChatBubbleBottomCenterTextIcon } from 'app/components/icons-svg'

// Color theme values for green, blue, and purple themes
const COLOR_THEMES = {
  green: {
    light: {
      main: 'hsl(142.1, 76.2%, 36.3%)',
      mainForeground: 'hsl(355.7, 100%, 97.3%)',
    },
    dark: {
      main: 'hsl(142.1, 70.6%, 45.3%)',
      mainForeground: 'hsl(144.9, 80.4%, 10%)',
    },
  },
  blue: {
    light: {
      main: 'hsl(217.2, 91.2%, 59.8%)',
      mainForeground: 'hsl(222.2, 47.4%, 11.2%)',
    },
    dark: {
      main: 'hsl(217.2, 91.2%, 59.8%)',
      mainForeground: 'hsl(222.2, 47.4%, 11.2%)',
    },
  },
  purple: {
    light: {
      main: 'hsl(270, 91%, 65%)',
      mainForeground: 'hsl(355.7, 100%, 97.3%)',
    },
    dark: {
      main: 'hsl(270, 91%, 65%)',
      mainForeground: 'hsl(270, 100%, 95%)',
    },
  },
}

export default function TabLayout() {
  const { colorScheme } = useColorScheme()
  const { colorTheme } = useColorTheme()
  const { user } = useAuth()
  const { isAdmin } = useIsAdmin()

  // Get actual color values for both platforms
  const themeValues = COLOR_THEMES[colorTheme][colorScheme === 'dark' ? 'dark' : 'light']
  const main = themeValues.main

  // Explicit background for the header + bottom tab bar so the theme covers the
  // status-bar and home-indicator safe areas. Matches the `bg-black`/`bg-white`
  // the screens use for their bodies so there is no seam at the bars.
  const isDark = colorScheme === 'dark'
  const navBackground = isDark ? '#000000' : '#ffffff'
  const navBorder = isDark ? '#27272a' : '#e4e4e7'

  const HeaderTitle = () => (
    <View style={styles.headerTitleContainer}>
      <ExpoImage
        source={
          isDark
            ? require('../../assets/images/logo-dark.png')
            : require('../../assets/images/logo-light.png')
        }
        style={styles.headerLogo}
        contentFit="contain"
        accessibilityLabel="JomContest"
      />
      <View style={[styles.betaBadge, { backgroundColor: main }]}>
        <Text style={styles.betaText}>BETA</Text>
      </View>
    </View>
  )

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: main,
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        headerTintColor: isDark ? '#ffffff' : '#000000',
        headerTitleStyle: {
          color: isDark ? '#ffffff' : '#000000',
        },
        headerStyle: {
          backgroundColor: navBackground,
        },
        tabBarStyle: {
          display: 'flex',
          backgroundColor: navBackground,
          borderTopColor: navBorder,
        },
        sceneStyle: {
          backgroundColor: navBackground,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <HeaderTitle />,
          headerShown: true,
          headerTitleAlign: 'center',
          headerLeft: user
            ? () => (
                <FeedbackDialog>
                  <View
                    style={{
                      paddingLeft: 16,
                      paddingRight: 8,
                      paddingVertical: 8,
                    }}
                  >
                    <IconWrapper
                      Icon={ChatBubbleBottomCenterTextIcon}
                      size={24}
                      color={main}
                    />
                  </View>
                </FeedbackDialog>
              )
            : undefined,
          tabBarLabel: i18n._(msg`Home`),
          tabBarIcon: ({ color }) => (
            <IconWrapper Icon={HomeOutline} size={28} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: i18n._(msg`Search`),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <IconWrapper Icon={SearchOutline} size={28} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: i18n._(msg`Profile`),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <UserCircleOutline size={28} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: i18n._(msg`Admin`),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <IconWrapper
              Icon={BuildingLibraryOutline}
              size={28}
              color={color as string}
            />
          ),
          href: Platform.OS === 'web' && isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 58,
    height: 36,
  },
  betaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  betaText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
})
