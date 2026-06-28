import { useLayoutEffect, useState } from 'react'
import { Pressable, ActivityIndicator, Platform, Text, View } from 'react-native'
import { useNavigation } from 'expo-router'

export default function AdminPage() {
  const navigation = useNavigation()
  const [syncingMeili, setSyncingMeili] = useState(false)
  const [syncingPublic, setSyncingPublic] = useState(false)

  const handleSyncMeilisearch = async () => {
    const {
      setupMeilisearchIndex,
      syncContestsToMeilisearch,
    } = require('app/lib/meilisearch/api')
    const { toast } = require('app/lib/sonner-universal')

    setSyncingMeili(true)
    try {
      await setupMeilisearchIndex()
      await syncContestsToMeilisearch()
      toast.success('Meilisearch synced!')
    } catch (error) {
      toast.error('Failed to sync: ' + (error as Error).message)
    } finally {
      setSyncingMeili(false)
    }
  }

  const handleSyncPublicContests = async () => {
    const { syncPublicContests } = require('app/lib/public-contests/api')
    const { toast } = require('app/lib/sonner-universal')

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
      toast.error('Failed to sync: ' + (error as Error).message)
    } finally {
      setSyncingPublic(false)
    }
  }

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return

    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 8, marginRight: 16 }}>
          <Pressable
            onPress={handleSyncPublicContests}
            disabled={syncingPublic}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: syncingPublic ? '#dbeafe' : '#eff6ff',
              opacity: syncingPublic ? 0.6 : 1,
            }}
          >
            {({ pressed }) => (
              <>
                {syncingPublic ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: '#1d4ed8',
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    Sync Public
                  </Text>
                )}
              </>
            )}
          </Pressable>
          <Pressable
            onPress={handleSyncMeilisearch}
            disabled={syncingMeili}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: syncingMeili ? '#e5e7eb' : '#f3f4f6',
              opacity: syncingMeili ? 0.6 : 1,
            }}
          >
            {({ pressed }) => (
              <>
                {syncingMeili ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: '#374151',
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    Sync Meili
                  </Text>
                )}
              </>
            )}
          </Pressable>
        </View>
      ),
    })
  }, [navigation, syncingMeili, syncingPublic])

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Admin tools are available on web only.</Text>
      </View>
    )
  }

  const AdminScreen = require('app/features/admin/screen').default

  return <AdminScreen />
}
