'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ActivityIndicator, View, Platform } from 'react-native'
import { useColorScheme } from 'app/hooks/useColorScheme'

import { useRouter } from 'app/lib/router-universal'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Cog6ToothOutline } from 'app/components/icons-svg/Cog6ToothOutline'
import { Cog6ToothSolid } from 'app/components/icons-svg/Cog6ToothSolid'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'
import { BellAlertOutline } from 'app/components/icons-svg/BellAlertOutline'
import { BellAlertSolid } from 'app/components/icons-svg/BellAlertSolid'
import { useAuth } from 'app/contexts/AuthContext'
import { usePoints } from 'app/contexts/PointsContext'
import { account } from 'app/provider/appwrite/api'
import { BACKEND } from 'app/lib/backend'
import { supabaseSignOut } from 'app/lib/supabase/auth'
import { activateLocale, locales } from 'app/lib/lingui/i18n'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'app/components/ui/tabs'
import { useOAuthCallback } from 'app/hooks/useOAuthCallback'
import GeneralTabContent from 'app/features/profile/components/GeneralTabContent'
import SavedTabContent from 'app/features/profile/components/SavedTabContent'
import AlertsTabContent from 'app/features/profile/components/AlertsTabContent'
import { Trans } from '@lingui/react/macro'

export default function ProfileScreen() {
  const { user, isLoading: isLoadingUser, refreshUser } = useAuth()
  const { refreshPoints } = usePoints()
  const queryClient = useQueryClient()
  const { isDarkColorScheme } = useColorScheme()

  // Handle post-OAuth callback to download profile picture
  useOAuthCallback()

  const userDisplayName = user?.name
  const userEmail = user?.email

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<keyof typeof locales>('en')
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(true)

  // Load language preference from Appwrite user preferences
  useEffect(() => {
    const fetchLanguagePreference = async () => {
      setIsLoadingLanguage(true)
      try {
        // Only fetch preferences if user is logged in
        if (user) {
          const prefs = await account.getPrefs()
          const lang = (prefs as any)?.language || 'en'
          setCurrentLocale(lang === 'ms' ? 'ms' : 'en')
        } else {
          // If not logged in, keep default 'en'
          setCurrentLocale('en')
        }
      } catch {
        // If preferences unavailable, keep default 'en'
        setCurrentLocale('en')
      } finally {
        setIsLoadingLanguage(false)
      }
    }
    fetchLanguagePreference()
  }, [user]) // Re-run when user login state changes

  const toggleLanguage = async () => {
    const newLocale = currentLocale === 'en' ? 'ms' : 'en'
    activateLocale(newLocale)
    setCurrentLocale(newLocale)
    try {
      // IMPORTANT: Get current prefs first, then merge with new language
      // This prevents overwriting other preferences like profile picture
      const currentPrefs = await account.getPrefs()
      await account.updatePrefs({ ...currentPrefs, language: newLocale })
      // Invalidate language preference query so other screens update immediately
      queryClient.invalidateQueries({ queryKey: ['user-language-preference'] })
    } catch {}
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      if (BACKEND === 'supabase') {
        await supabaseSignOut()
      } else {
        await account.deleteSession('current')
      }
      await refreshUser()
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Tab state management with URL persistence on web
  const router = useRouter()
  const [tabValue, setTabValue] = useState('general')

  // Refresh points when profile page is loaded or user changes
  useEffect(() => {
    if (user) {
      refreshPoints()
    }
  }, [user, refreshPoints])

  // On web, read tab from URL or sessionStorage on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      // First check URL params
      const params = new URLSearchParams(window.location.search)
      const urlTab = params.get('tab')

      // Then check if we're returning from a contest detail page
      const savedTab = sessionStorage.getItem('profile_active_tab')
      const navigatedFromList = sessionStorage.getItem('navigated_from_list')

      if (
        navigatedFromList === 'true' &&
        savedTab &&
        ['general', 'saved', 'alert'].includes(savedTab)
      ) {
        setTabValue(savedTab)
        // Update URL to reflect the tab
        const url = new URL(window.location.href)
        url.searchParams.set('tab', savedTab)
        window.history.replaceState({}, '', url.toString())
        // Clear the navigation flag
        sessionStorage.removeItem('navigated_from_list')
      } else if (urlTab && ['general', 'saved', 'alert'].includes(urlTab)) {
        setTabValue(urlTab)
      }
    }
  }, [])

  // Handle tab change with URL update and sessionStorage on web
  const handleTabChange = (value: string) => {
    setTabValue(value)
    // Refresh points when switching to general tab
    if (value === 'general') {
      refreshPoints()
    }
    if (Platform.OS === 'web') {
      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set('tab', value)
      window.history.replaceState({}, '', url.toString())
      // Save to sessionStorage for when user navigates away and back
      sessionStorage.setItem('profile_active_tab', value)
    }
  }

  return (
    <View className="flex-1 dark:bg-black bg-white web:pt-20 native:pt-4">
      {isLoadingUser ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="grey" />
        </View>
      ) : (
        <>
          {user ? (
            <>
              <Text className="text-2xl font-bold color-main text-center mb-4 native:hidden">
                <Trans>Profile</Trans>
              </Text>
              <Tabs
                value={tabValue}
                onValueChange={handleTabChange}
                className="flex-1 w-full"
              >
                <View className="px-2">
                  <TabsList className="w-full" sticky stickyOffset={68}>
                    <TabsTrigger value="general" className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {tabValue === 'general' ? (
                          <Cog6ToothSolid
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        ) : (
                          <Cog6ToothOutline
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        )}
                        <Text>
                          <Trans>General</Trans>
                        </Text>
                      </View>
                    </TabsTrigger>
                    <TabsTrigger value="saved" className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {tabValue === 'saved' ? (
                          <BookmarkSolidIcon
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        ) : (
                          <BookmarkIcon
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        )}
                        <Text>
                          <Trans>Saved</Trans>
                        </Text>
                      </View>
                    </TabsTrigger>
                    <TabsTrigger value="alert" className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {tabValue === 'alert' ? (
                          <BellAlertSolid
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        ) : (
                          <BellAlertOutline
                            className="text-foreground"
                            width={18}
                            height={18}
                          />
                        )}
                        <Text>
                          <Trans>Alerts</Trans>
                        </Text>
                      </View>
                    </TabsTrigger>
                  </TabsList>
                </View>

                <TabsContent value="general">
                  <GeneralTabContent
                    user={user}
                    userDisplayName={userDisplayName}
                    userEmail={userEmail}
                    currentLocale={currentLocale}
                    isLoadingLanguage={isLoadingLanguage}
                    toggleLanguage={toggleLanguage}
                    handleSignOut={handleSignOut}
                    isLoggingOut={isLoggingOut}
                    isDarkColorScheme={isDarkColorScheme}
                  />
                </TabsContent>

                <TabsContent value="saved">
                  <SavedTabContent />
                </TabsContent>

                <TabsContent value="alert">
                  <AlertsTabContent />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            // Logged out state - horizontally centered at top
            <View className="flex-1 items-center p-10 pt-4">
              <View className="items-center max-w-xs">
                <Text className="text-2xl font-bold color-main text-center mb-6 native:hidden">
                  <Trans>Profile</Trans>
                </Text>
                <Text
                  className={`text-base text-center leading-6 mb-6 ${
                    isDarkColorScheme ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <Trans>
                    Please sign in to view and manage your profile, saved
                    contests, and account settings.
                  </Trans>
                </Text>
                <View className="w-full items-center">
                  <Button
                    onPress={() =>
                      router.push('/sign-in-register?redirect=/profile')
                    }
                    className="mt-4"
                  >
                    <Text>
                      <Trans>Sign In / Register</Trans>
                    </Text>
                  </Button>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}
