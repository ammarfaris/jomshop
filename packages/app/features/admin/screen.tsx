import { useEffect, useState } from 'react'
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

import { teams } from 'app/provider/appwrite/api'
import { useAuth } from 'app/contexts/AuthContext'
import { ADMIN_TEAM_ID } from 'app/provider/appwrite/constants'
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

  const { user, isLoading } = useAuth()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingTeam, setCheckingTeam] = useState(true)
  const [tabValue, setTabValue] = useState('create')

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      setIsAdmin(false)
      setCheckingTeam(false)
      return
    }
    setCheckingTeam(true)
    teams
      .list()
      .then((res) => {
        const found = res.teams.some((t) => t.$id === ADMIN_TEAM_ID)
        setIsAdmin(found)
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setCheckingTeam(false))
  }, [user, isLoading])

  if (isLoading || checkingTeam) {
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
                'Failed to initialize Meilisearch: ' + (error as Error).message,
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
                toast.error('Sync failed: ' + (result.error ?? 'Unknown error'))
              }
            } catch (error) {
              toast.error(
                'Failed to sync public contests: ' + (error as Error).message,
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
