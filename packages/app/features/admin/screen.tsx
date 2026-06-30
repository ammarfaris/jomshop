import { useState } from 'react'
import {
  ActivityIndicator,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native'

import { Button } from 'app/components/ui/button'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { Text } from 'app/components/ui/text'
import { Tabs, TabsList, TabsTrigger } from 'app/components/ui/tabs'

import { useAuth } from 'app/contexts/AuthContext'
import { BACKEND } from 'app/lib/backend'
import {
  setupMeilisearchIndex,
  syncContestsToMeilisearch,
} from 'app/lib/meilisearch/api'
import { syncPublicContests } from 'app/lib/public-contests/api'
import CreateContestTabContent from './CreateContestTabContent'
import EditContestTabContent from './EditContestTabContent'
import PointsManagerTabContent from './PointsManagerTabContent'
import ReferralManagerTabContent from './ReferralManagerTabContent'
import { toast } from 'app/lib/sonner-universal'

export default function AdminScreen() {
  const [initializingSearch, setInitializingSearch] = useState(false)
  const [syncingPublic, setSyncingPublic] = useState(false)
  const { width } = useWindowDimensions()
  const safeWidth = Math.max(width || 0, 320)
  const isDesktopLayout = safeWidth >= 900
  const containerMaxWidth = isDesktopLayout
    ? Math.min(safeWidth - 80, 1280)
    : Math.min(safeWidth - 40, 420)

  // Admin status is resolved once in AuthContext (Appwrite team membership or the
  // Supabase user_roles table), so the gate works for whichever backend is active.
  const { user, isLoading, isAdmin, isLoadingAdmin } = useAuth()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const [tabValue, setTabValue] = useState('create')

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
        {/* Appwrite-era tools: Meilisearch + publicContests sync. On Supabase,
            search runs on the search_contests RPC and the public list is exposed
            directly via RLS, so these are obsolete and hidden. */}
        {BACKEND === 'appwrite' && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="px-3 py-1"
              onPress={async () => {
                setInitializingSearch(true)
                try {
                  await setupMeilisearchIndex()
                  await syncContestsToMeilisearch()
                  toast.success('Meilisearch initialized and contests synced!')
                } catch (error) {
                  toast.error(
                    'Failed to initialize Meilisearch: ' +
                      (error as Error).message,
                  )
                } finally {
                  setInitializingSearch(false)
                }
              }}
              disabled={initializingSearch}
            >
              <Text className="text-xs font-semibold">
                {initializingSearch ? 'Syncing...' : 'Init / Sync Meilisearch'}
              </Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="px-3 py-1"
              onPress={async () => {
                setSyncingPublic(true)
                try {
                  const result = await syncPublicContests()
                  if (result.success) {
                    toast.success(
                      `Public contests synced! ${result.contests?.synced ?? 0} contests, ${result.translations?.synced ?? 0} translations`,
                    )
                  } else {
                    toast.error(
                      'Sync failed: ' + (result.error ?? 'Unknown error'),
                    )
                  }
                } catch (error) {
                  toast.error(
                    'Failed to sync public contests: ' +
                      (error as Error).message,
                  )
                } finally {
                  setSyncingPublic(false)
                }
              }}
              disabled={syncingPublic}
            >
              <Text className="text-xs font-semibold">
                {syncingPublic ? 'Syncing...' : 'Sync Public Contests'}
              </Text>
            </Button>
          </>
        )}
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
