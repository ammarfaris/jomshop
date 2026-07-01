import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native'

import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { Text } from 'app/components/ui/text'
import { Tabs, TabsList, TabsTrigger } from 'app/components/ui/tabs'

import { useAuth } from 'app/contexts/AuthContext'
import CreateContestTabContent from './CreateContestTabContent'
import EditContestTabContent from './EditContestTabContent'
import PointsManagerTabContent from './PointsManagerTabContent'
import ReferralManagerTabContent from './ReferralManagerTabContent'

export default function AdminScreen() {
  const { width } = useWindowDimensions()
  const safeWidth = Math.max(width || 0, 320)
  const isDesktopLayout = safeWidth >= 900
  const containerMaxWidth = isDesktopLayout
    ? Math.min(safeWidth - 80, 1280)
    : Math.min(safeWidth - 40, 420)

  // Admin status is resolved once in AuthContext (the Supabase user_roles table).
  const { user, isLoading, isAdmin, isLoadingAdmin } = useAuth()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const [tabValue, setTabValue] = useState('create')
  const [initialEditSlug, setInitialEditSlug] = useState<string | undefined>(
    undefined,
  )

  // Honor review deep-links from the ingest-contest function:
  // /admin?tab=edit&slug=<slug>. Web-only (the review link targets the web admin
  // panel); native simply falls back to the default Create tab.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.search) return
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const slug = params.get('slug')
    if (slug) setInitialEditSlug(slug)
    if (tab && ['create', 'edit', 'points', 'referrals'].includes(tab)) {
      setTabValue(tab)
    } else if (slug) {
      setTabValue('edit')
    }
  }, [])

  if (isLoading || isLoadingAdmin) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="grey" />
      </View>
    )
  }

  if (!user || !isAdmin) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Not authorized!</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 p-4 dark:bg-black bg-white web:pt-20">
      <View className="flex-row items-center justify-center gap-3 mb-4 native:hidden">
        <Text
          className="text-2xl font-bold"
          style={Platform.OS === 'web' ? undefined : { color: main }}
        >
          Admin Panel
        </Text>
      </View>
      <Tabs
        value={tabValue}
        onValueChange={setTabValue}
        className="flex-1 w-full"
      >
        <TabsList>
          <TabsTrigger value="create">
            <Text>Create Contest</Text>
          </TabsTrigger>
          <TabsTrigger value="edit">
            <Text>Edit Contest</Text>
          </TabsTrigger>
          <TabsTrigger value="points">
            <Text>Award Points</Text>
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <Text>Referral Limits</Text>
          </TabsTrigger>
        </TabsList>

        {/* Keep both tab contents mounted to preserve state */}
        <View className="flex-1 border border-border rounded-lg mt-2">
          <View
            className="flex-1"
            style={{ display: tabValue === 'create' ? 'flex' : 'none' }}
          >
            <CreateContestTabContent
              user={user}
              isDarkColorScheme={false}
              containerMaxWidth={containerMaxWidth}
              isDesktopLayout={isDesktopLayout}
            />
          </View>

          <View
            className="flex-1"
            style={{ display: tabValue === 'edit' ? 'flex' : 'none' }}
          >
            <EditContestTabContent
              user={user}
              isDarkColorScheme={false}
              containerMaxWidth={containerMaxWidth}
              isDesktopLayout={isDesktopLayout}
              initialEditSlug={initialEditSlug}
            />
          </View>

          <View
            className="flex-1"
            style={{ display: tabValue === 'points' ? 'flex' : 'none' }}
          >
            <PointsManagerTabContent containerMaxWidth={containerMaxWidth} />
          </View>

          <View
            className="flex-1"
            style={{ display: tabValue === 'referrals' ? 'flex' : 'none' }}
          >
            <ReferralManagerTabContent containerMaxWidth={containerMaxWidth} />
          </View>
        </View>
      </Tabs>
    </View>
  )
}
