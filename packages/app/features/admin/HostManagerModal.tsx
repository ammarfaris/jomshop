import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  View,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Textarea } from 'app/components/ui/textarea'
import { Image as ExpoImage } from 'expo-image'
import { Models, Permission, Query, Role } from 'app/lib/appwrite-universal'
import { tablesDB, storage, functions } from 'app/provider/appwrite/api'
import {
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTEST_HOSTS_COLLECTION_ID,
  CONTEST_HOSTS_BUCKET_ID,
  ADMIN_TEAM_ID,
  GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID,
} from 'app/provider/appwrite/constants'
import { useAuth } from 'app/contexts/AuthContext'
import { useColorScheme } from 'app/hooks/useColorScheme'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'app/components/ui/alert-dialog'
import { PortalHost } from '@rn-primitives/portal'
import { HostImage } from 'app/components/HostImage'

export type HostDoc = Models.Document & {
  name: string
  slug: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash: string
  bio?: string
}

const DEFAULT_BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

export default function HostManagerModal(props: {
  visible: boolean
  selectedHostIds: string[]
  onChangeSelection: (ids: string[], hosts: HostDoc[]) => void
  onRequestClose: () => void
}) {
  const { visible, selectedHostIds, onChangeSelection, onRequestClose } = props
  const { user } = useAuth()
  const { isDarkColorScheme } = useColorScheme()

  // Responsive modal width: min(700px, 92vw). On small web screens, use full width.
  const vw = Dimensions.get('window').width
  const isSmallWeb = Platform.OS === 'web' && vw <= 480
  const containerWidth = isSmallWeb
    ? Math.round(vw)
    : Math.min(700, Math.round(vw * 0.92))

  const [allHosts, setAllHosts] = useState<HostDoc[]>([])
  const [hostsLoading, setHostsLoading] = useState(false)
  const [hostsError, setHostsError] = useState<string | null>(null)
  const [deletingHostIds, setDeletingHostIds] = useState<Set<string>>(new Set())

  // Create new host form
  const [newHostName, setNewHostName] = useState('')
  const [newHostSlug, setNewHostSlug] = useState('')
  const [newHostBio, setNewHostBio] = useState('')
  const [newHostImageAsset, setNewHostImageAsset] = useState<any | null>(null)
  const [creatingHost, setCreatingHost] = useState(false)
  // Edit host state
  const [editingHost, setEditingHost] = useState<HostDoc | null>(null)
  const [updatingHost, setUpdatingHost] = useState(false)
  // Show/hide form (add mode hidden by default)
  const [showForm, setShowForm] = useState(false)
  // Search state
  const [search, setSearch] = useState('')
  // Toggle to list all hosts (web-only link shown)
  const [showAll, setShowAll] = useState(false)

  // (Realtime removed) We'll explicitly refresh when needed.

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  useEffect(() => {
    if (!newHostName) setNewHostSlug('')
    else setNewHostSlug(slugify(newHostName))
  }, [newHostName])

  // Load hosts on open (no realtime subscription)
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      setHostsLoading(true)
      setHostsError(null)
      try {
        const res = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: CONTEST_HOSTS_COLLECTION_ID,
          queries: [Query.orderAsc('name'), Query.limit(100)],
        })
        if (!cancelled) setAllHosts(res.rows as unknown as HostDoc[])
      } catch (e: any) {
        if (!cancelled) setHostsError(e?.message || 'Failed to load hosts')
      } finally {
        if (!cancelled) setHostsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  // On web, lock background scrolling while the modal is visible
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return
    const prevBody = document.body.style.overflow
    const html = document.documentElement
    const prevHtml = html?.style?.overflow
    const appRoot =
      document.getElementById('__next') || document.getElementById('root')
    const prevAppRoot = appRoot?.style?.overflow
    if (visible) {
      document.body.style.overflow = 'hidden'
      if (html) html.style.overflow = 'hidden'
      if (appRoot) appRoot.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = prevBody
      if (html && typeof prevHtml === 'string') html.style.overflow = prevHtml
      if (appRoot && typeof prevAppRoot === 'string')
        appRoot.style.overflow = prevAppRoot
    }
  }, [visible])

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const limit = Platform.OS === 'web' ? 5 : 15
    const toTime = (h: any) => {
      const val =
        h?.$updatedAt ||
        h?.updatedAt ||
        h?.updated_at ||
        h?.$createdAt ||
        h?.createdAt ||
        h?.created_at
      const t =
        typeof val === 'string'
          ? Date.parse(val)
          : typeof val === 'number'
            ? val
            : 0
      return Number.isFinite(t) ? t : 0
    }

    if (q) {
      const matches = allHosts.filter(
        (h) =>
          (h.name || '').toLowerCase().includes(q) ||
          (h.slug || '').toLowerCase().includes(q),
      )
      return matches.sort((a, b) => toTime(b) - toTime(a))
    }

    // Not searching: show selected hosts first (if any), followed by most recent hosts excluding those selected
    const byId = new Map(allHosts.map((h) => [h.$id, h]))
    const selectedDocs = selectedHostIds
      .map((id) => byId.get(id))
      .filter(Boolean) as HostDoc[]
    const selectedSet = new Set(selectedHostIds)
    const restSorted = [...allHosts]
      .filter((h) => !selectedSet.has(h.$id))
      .sort((a, b) => toTime(b) - toTime(a))
    const rest = !showAll ? restSorted.slice(0, limit) : restSorted

    return [...selectedDocs, ...rest]
  }, [search, allHosts, selectedHostIds, showAll])

  const toggleHostSelected = (hostId: string) => {
    const nextIds = selectedHostIds.includes(hostId)
      ? selectedHostIds.filter((id) => id !== hostId)
      : [...selectedHostIds, hostId]
    const byId = new Map(allHosts.map((h) => [h.$id, h]))
    const nextHosts = nextIds
      .map((id) => byId.get(id))
      .filter(Boolean) as HostDoc[]
    onChangeSelection(nextIds, nextHosts)
    // Hide form without resetting values or edit state
    setShowForm(false)
  }

  const startEditHost = (host: HostDoc) => {
    setEditingHost(host)
    setNewHostName(host.name)
    setNewHostSlug(host.slug)
    setNewHostBio(host.bio || '')
    setNewHostImageAsset(null)
    setShowForm(true)
  }

  const pickNewHostImage = async () => {
    const ImagePicker = await import('expo-image-picker')
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      alert('Media library permission is required to pick an image')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    })
    if ((result as any).canceled || !(result as any).assets?.length) return
    setNewHostImageAsset((result as any).assets[0])
  }

  const handleCreateHost = async () => {
    if (!user) return
    if (!newHostName.trim() || !newHostSlug.trim() || !newHostImageAsset) {
      alert('Please provide name and image')
      return
    }
    setCreatingHost(true)
    try {
      // Prepare file object for upload
      let fileToUpload: any
      const asset = newHostImageAsset
      const getFileExtension = (fileName: string | undefined): string => {
        if (!fileName) return 'jpg'
        const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
        return match && typeof match[1] === 'string'
          ? match[1].toLowerCase()
          : 'jpg'
      }
      const getImageFileName = (
        fileName: string | undefined,
        base: string,
      ): string => {
        const baseSlug = slugify(base || 'host')
        const safeDate = new Date().toISOString().split('T')[0]
        const ext = getFileExtension(fileName)
        return `${baseSlug}-${safeDate}.${ext}`
      }
      if (Platform.OS === 'web') {
        if (asset instanceof File) {
          fileToUpload = asset
        } else {
          const response = await fetch(asset.uri)
          const blob = await response.blob()
          fileToUpload = new File(
            [blob],
            getImageFileName(asset.fileName, newHostName),
            {
              type: asset.type || 'image/jpeg',
            },
          )
        }
      } else {
        fileToUpload = {
          uri: asset.uri,
          name: getImageFileName(asset.fileName, newHostName),
          type: asset.mimeType || asset.type || 'image/jpeg',
          size: (asset as any).fileSize ?? undefined,
        } as any
      }

      const uploaded = await storage.createFile(
        CONTEST_HOSTS_BUCKET_ID,
        'unique()',
        fileToUpload,
        [Permission.write(Role.team(ADMIN_TEAM_ID))],
      )

      // Call function to generate blurhash and token for host image
      let tokenSecret: string | undefined
      let blurhash: string | undefined
      try {
        const exec = await functions.createExecution(
          GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID,
          JSON.stringify({
            fileId: uploaded.$id,
            bucketId: CONTEST_HOSTS_BUCKET_ID,
            file_label: 'host',
          }),
        )
        const raw =
          (exec as any).responseBody ??
          (exec as any).response ??
          (exec as any).stdout
        if (typeof raw === 'string' && raw.trim()) {
          const parsed = JSON.parse(raw)
          tokenSecret = parsed.tokenSecret
          blurhash = parsed.blurhash
        }
        if (!tokenSecret) {
          alert(
            'Warning: Token generation failed for the host image. The image may appear blurred for some users. Please re-save this host to retry.',
          )
        }
      } catch (fnErr: any) {
        alert(
          'Warning: Token generation failed for the host image. The image may appear blurred for some users. Please re-save this host to retry.\n\nError: ' +
            (fnErr?.message || String(fnErr)),
        )
      }

      // Create host document
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_HOSTS_COLLECTION_ID,
        rowId: 'unique()',
        data: {
          name: newHostName.trim(),
          slug: newHostSlug.trim(),
          img_id: uploaded.$id,
          img_token_secret: tokenSecret ?? null,
          img_blurhash: blurhash ?? DEFAULT_BLURHASH,
          bio: newHostBio || '',
        },
        permissions: [Permission.write(Role.team(ADMIN_TEAM_ID))],
      })

      // Reset local form
      setNewHostName('')
      setNewHostSlug('')
      setNewHostBio('')
      setNewHostImageAsset(null)

      // Auto-refresh hosts list after successful creation
      try {
        const refreshRes = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: CONTEST_HOSTS_COLLECTION_ID,
          queries: [Query.orderAsc('name'), Query.limit(100)],
        })
        setAllHosts(refreshRes.rows as unknown as HostDoc[])
      } catch {}
      setShowForm(false)
    } catch (e: any) {
      alert('Failed to create host: ' + (e?.message || 'Unknown error'))
    } finally {
      setCreatingHost(false)
    }
  }

  const handleSaveHost = async () => {
    if (!user || !editingHost) return
    if (!newHostName.trim() || !newHostSlug.trim()) {
      alert('Please provide name and slug')
      return
    }
    setUpdatingHost(true)
    try {
      let imgId = editingHost.img_id
      let tokenSecret: string | undefined =
        (editingHost.img_token_secret as string | undefined) || undefined
      let blurhash: string | undefined = editingHost.img_blurhash || undefined

      if (newHostImageAsset) {
        // Prepare file object for upload (same as create)
        const asset = newHostImageAsset
        const getFileExtension = (fileName: string | undefined): string => {
          if (!fileName) return 'jpg'
          const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
          return match && typeof match[1] === 'string'
            ? match[1].toLowerCase()
            : 'jpg'
        }
        const getImageFileName = (
          fileName: string | undefined,
          base: string,
        ): string => {
          const baseSlug = slugify(base || 'host')
          const safeDate = new Date().toISOString().split('T')[0]
          const ext = getFileExtension(fileName)
          return `${baseSlug}-${safeDate}.${ext}`
        }

        let fileToUpload: any
        if (Platform.OS === 'web') {
          if (asset instanceof File) {
            fileToUpload = asset
          } else {
            const response = await fetch(asset.uri)
            const blob = await response.blob()
            fileToUpload = new File(
              [blob],
              getImageFileName(asset.fileName, newHostName),
              {
                type: asset.type || 'image/jpeg',
              },
            )
          }
        } else {
          fileToUpload = {
            uri: asset.uri,
            name: getImageFileName(asset.fileName, newHostName),
            type: asset.mimeType || asset.type || 'image/jpeg',
            size: (asset as any).fileSize ?? undefined,
          } as any
        }

        const uploaded = await storage.createFile(
          CONTEST_HOSTS_BUCKET_ID,
          'unique()',
          fileToUpload,
          [Permission.write(Role.team(ADMIN_TEAM_ID))],
        )

        // Generate blurhash and token for new image
        try {
          const exec = await functions.createExecution(
            GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID,
            JSON.stringify({
              fileId: uploaded.$id,
              bucketId: CONTEST_HOSTS_BUCKET_ID,
              file_label: 'host',
            }),
          )
          const raw =
            (exec as any).responseBody ??
            (exec as any).response ??
            (exec as any).stdout
          if (typeof raw === 'string' && raw.trim()) {
            const parsed = JSON.parse(raw)
            tokenSecret = parsed.tokenSecret
            blurhash = parsed.blurhash
          }
          if (!tokenSecret) {
            alert(
              'Warning: Token generation failed for the host image. The image may appear blurred for some users. Please re-save this host to retry.',
            )
          }
        } catch (fnErr: any) {
          alert(
            'Warning: Token generation failed for the host image. The image may appear blurred for some users. Please re-save this host to retry.\n\nError: ' +
              (fnErr?.message || String(fnErr)),
          )
        }

        // Replace image id
        const oldImgId = editingHost.img_id
        imgId = uploaded.$id
        // Best-effort delete old file
        if (oldImgId && oldImgId !== imgId) {
          try {
            await storage.deleteFile(CONTEST_HOSTS_BUCKET_ID, oldImgId)
          } catch {}
        }
      }

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_HOSTS_COLLECTION_ID,
        rowId: editingHost.$id,
        data: {
          name: newHostName.trim(),
          slug: newHostSlug.trim(),
          bio: newHostBio || '',
          img_id: imgId,
          img_token_secret: tokenSecret ?? null,
          img_blurhash: blurhash ?? DEFAULT_BLURHASH,
        },
      })

      // Refresh hosts list and update selection refs so parent gets fresh objects
      try {
        const refreshRes = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: CONTEST_HOSTS_COLLECTION_ID,
          queries: [Query.orderAsc('name'), Query.limit(100)],
        })
        const updatedAll = refreshRes.rows as unknown as HostDoc[]
        setAllHosts(updatedAll)
        if (selectedHostIds.length > 0) {
          const byId = new Map(updatedAll.map((h) => [h.$id, h]))
          const nextHosts = selectedHostIds
            .map((id) => byId.get(id))
            .filter(Boolean) as HostDoc[]
          onChangeSelection(selectedHostIds, nextHosts)
        }
      } catch {}

      setEditingHost(null)
      setNewHostName('')
      setNewHostSlug('')
      setNewHostBio('')
      setNewHostImageAsset(null)
      setShowForm(false)
    } catch (e: any) {
      alert('Failed to save host: ' + (e?.message || 'Unknown error'))
    } finally {
      setUpdatingHost(false)
    }
  }

  const handleDeleteHost = async (hostId: string) => {
    // Guard: prevent deletion if any contests reference this host
    try {
      const contestsUsingHost = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: CONTESTS_COLLECTION_ID,
        queries: [Query.contains('host_ids', hostId), Query.limit(50)],
      })
      if (contestsUsingHost.rows.length > 0) {
        const contestTitles = (contestsUsingHost.rows as any[])
          .map((c) => c.title)
          .filter(Boolean)
        const titlesList = contestTitles.map((t) => `- ${t}`).join('\n')
        alert(
          `Cannot delete host. ${contestsUsingHost.rows.length} contest(s) reference this host:\n${titlesList}`,
        )
        return
      }
    } catch (e: any) {
      alert('Failed to verify host usage: ' + (e?.message || 'Unknown error'))
      return
    }

    setDeletingHostIds((prev) => {
      const next = new Set<string>()
      prev.forEach((v) => next.add(v))
      next.add(hostId)
      return next
    })
    try {
      // best-effort delete associated image (requires reading host doc)
      const current = allHosts.find((h) => h.$id === hostId)
      if (current?.img_id) {
        try {
          await storage.deleteFile(CONTEST_HOSTS_BUCKET_ID, current.img_id)
        } catch {}
      }
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: CONTEST_HOSTS_COLLECTION_ID,
        rowId: hostId,
      })

      // Auto-refresh hosts list after deletion
      try {
        const refreshRes = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: CONTEST_HOSTS_COLLECTION_ID,
          queries: [Query.orderAsc('name'), Query.limit(100)],
        })
        setAllHosts(refreshRes.rows as unknown as HostDoc[])
      } catch {}

      // update selection
      const nextIds = selectedHostIds.filter((id) => id !== hostId)
      const byId = new Map(allHosts.map((h) => [h.$id, h]))
      const nextHosts = nextIds
        .map((id) => byId.get(id))
        .filter(Boolean) as HostDoc[]
      onChangeSelection(nextIds, nextHosts)
    } catch (e: any) {
      alert('Failed to delete host: ' + (e?.message || 'Unknown error'))
    } finally {
      setDeletingHostIds((prev) => {
        const next = new Set<string>()
        prev.forEach((v) => next.add(v))
        next.delete(hostId)
        return next
      })
    }
  }

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          { flex: 1 },
          Platform.select({
            web: {
              position: 'fixed' as any,
              top: 0 as any,
              right: 0 as any,
              bottom: 0 as any,
              left: 0 as any,
            },
            default: {},
          }) as any,
        ]}
      >
        <Pressable
          onPress={onRequestClose}
          style={[
            Platform.select({
              web: {
                position: 'fixed' as any,
                top: 0 as any,
                right: 0 as any,
                bottom: 0 as any,
                left: 0 as any,
                overflow: 'hidden' as any,
                touchAction: 'none' as any,
                WebkitOverflowScrolling: 'touch' as any,
                overscrollBehavior: 'contain' as any,
                zIndex: 1 as any,
              },
              default: {
                position: 'absolute' as any,
                top: 0 as any,
                right: 0 as any,
                bottom: 0 as any,
                left: 0 as any,
                zIndex: 1 as any,
              },
            }) as any,
          ]}
          className="bg-black/60 dark:bg-black/60"
        />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2,
            position:
              Platform.OS === 'web' ? ('relative' as any) : ('absolute' as any),
            top: 0 as any,
            right: 0 as any,
            bottom: 0 as any,
            left: 0 as any,
          }}
          pointerEvents="box-none"
        >
          <View
            style={[
              {
                width: containerWidth,
                borderRadius: isSmallWeb ? 0 : 12,
                padding: 16,
              },
              Platform.select({
                web: {
                  maxHeight: (isSmallWeb ? '100dvh' : '95vh') as any,
                  overflow: 'auto' as any,
                  WebkitOverflowScrolling: 'touch' as any,
                },
                default: {
                  maxHeight: Math.round(Dimensions.get('window').height * 0.95),
                },
              }) as any,
            ]}
            className="bg-white dark:bg-neutral-900"
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text className="text-xl font-bold text-black dark:text-neutral-100">
                Select Host(s)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="mr-2"
                  disabled={selectedHostIds.length === 0}
                  onPress={() => {
                    onChangeSelection([], [])
                  }}
                >
                  <Text>Deselect all</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={hostsLoading}
                  onPress={() => {
                    setHostsLoading(true)
                    setHostsError(null)
                    tablesDB
                      .listRows({
                        databaseId: DATABASE_ID,
                        tableId: CONTEST_HOSTS_COLLECTION_ID,
                        queries: [Query.orderAsc('name'), Query.limit(100)],
                      })
                      .then((res) =>
                        setAllHosts(res.rows as unknown as HostDoc[]),
                      )
                      .catch((e) =>
                        setHostsError(e?.message || 'Failed to refresh hosts'),
                      )
                      .finally(() => setHostsLoading(false))
                  }}
                >
                  <Text>{hostsLoading ? '🔄...' : '🔄'}</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2"
                  onPress={onRequestClose}
                >
                  <Text>✕</Text>
                </Button>
              </View>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Input
                placeholder="Search by name or slug"
                value={search}
                onChangeText={setSearch}
                className="dark:bg-neutral-800 dark:text-neutral-100"
              />
            </View>

            {!search.trim() && allHosts.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {showAll
                    ? `Listing all ${filteredHosts.length} hosts`
                    : selectedHostIds.length > 0
                      ? `Listing selected host and ${
                          Platform.OS === 'web'
                            ? 'up to 5 recently updated hosts'
                            : 'up to 15 recently updated hosts'
                        }`
                      : `Listing ${
                          Platform.OS === 'web'
                            ? 'up to 5 recently updated hosts'
                            : 'up to 15 recently updated hosts'
                        }`}
                </Text>
                {!showAll ? (
                  <Pressable
                    onPress={() => setShowAll(true)}
                    style={{ marginLeft: 6 }}
                  >
                    <Text className="text-xs text-blue-600 underline mb-2">
                      (list all)
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setShowAll(false)}
                    style={{ marginLeft: 6 }}
                  >
                    <Text className="text-xs text-blue-600 underline mb-2">
                      (list few)
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {hostsLoading ? (
              <ActivityIndicator color="grey" />
            ) : hostsError ? (
              <Text className="text-red-400 dark:text-red-400 mb-2">
                {hostsError}
              </Text>
            ) : allHosts.length === 0 ? (
              <Text className="text-gray-500 dark:text-gray-400 text-center py-4">
                There is no host to select, please add host below...
              </Text>
            ) : filteredHosts.length === 0 ? (
              <Text className="text-gray-500 dark:text-gray-400 text-center py-4">
                No hosts match your search
              </Text>
            ) : Platform.OS === 'web' ? (
              <View>
                {filteredHosts.map((h) => {
                  const checked = selectedHostIds.includes(h.$id)
                  return (
                    <View
                      key={h.$id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <Pressable
                        onPress={() => toggleHostSelected(h.$id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        accessibilityRole={
                          Platform.OS === 'web' ? ('button' as any) : undefined
                        }
                      >
                        <View style={{ marginRight: 10 }}>
                          <HostImage
                            imgId={h.img_id}
                            imgTokenSecret={h.img_token_secret}
                            imgBlurhash={h.img_blurhash}
                            width={50}
                            height={50}
                            borderRadius={6}
                            contentFit="contain"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text className="text-black dark:text-neutral-100">
                            {h.name}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {h.slug}
                          </Text>
                        </View>
                      </Pressable>
                      <Button
                        variant={checked ? 'secondary' : 'outline'}
                        size="sm"
                        onPress={() => toggleHostSelected(h.$id)}
                      >
                        <Text>{checked ? '✅' : '☑️'}</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onPress={() => startEditHost(h)}
                      >
                        <Text>Edit</Text>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            disabled={deletingHostIds.has(h.$id)}
                          >
                            {deletingHostIds.has(h.$id) ? (
                              <View className="flex-row items-center gap-1">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text>Deleting...</Text>
                              </View>
                            ) : (
                              <Text>Delete</Text>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent portalHost="host-manager-modal">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete host?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{h.name}". This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              <Text>Cancel</Text>
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onPress={() => handleDeleteHost(h.$id)}
                            >
                              {deletingHostIds.has(h.$id) ? (
                                <View className="flex-row items-center gap-1">
                                  <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                  />
                                  <Text>Deleting...</Text>
                                </View>
                              ) : (
                                <Text>Confirm Delete</Text>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </View>
                  )
                })}
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 260 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {filteredHosts.map((h) => {
                  const checked = selectedHostIds.includes(h.$id)
                  return (
                    <View
                      key={h.$id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <Pressable
                        onPress={() => toggleHostSelected(h.$id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        accessibilityRole={
                          Platform.OS === 'web' ? ('button' as any) : undefined
                        }
                      >
                        <View style={{ marginRight: 10 }}>
                          <HostImage
                            imgId={h.img_id}
                            imgTokenSecret={h.img_token_secret}
                            imgBlurhash={h.img_blurhash}
                            width={50}
                            height={50}
                            borderRadius={6}
                            contentFit="contain"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text className="text-black dark:text-neutral-100">
                            {h.name}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {h.slug}
                          </Text>
                        </View>
                      </Pressable>
                      <Button
                        variant={checked ? 'secondary' : 'outline'}
                        size="sm"
                        onPress={() => toggleHostSelected(h.$id)}
                      >
                        <Text>{checked ? '✅' : '☑️'}</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onPress={() => startEditHost(h)}
                      >
                        <Text>Edit</Text>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            disabled={deletingHostIds.has(h.$id)}
                          >
                            {deletingHostIds.has(h.$id) ? (
                              <View className="flex-row items-center gap-1">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text>Deleting...</Text>
                              </View>
                            ) : (
                              <Text>Delete</Text>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent portalHost="host-manager-modal">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete host?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{h.name}". This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              <Text>Cancel</Text>
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onPress={() => handleDeleteHost(h.$id)}
                            >
                              {deletingHostIds.has(h.$id) ? (
                                <View className="flex-row items-center gap-1">
                                  <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                  />
                                  <Text>Deleting...</Text>
                                </View>
                              ) : (
                                <Text>Confirm Delete</Text>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </View>
                  )
                })}
              </ScrollView>
            )}
            {!showForm ? (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                }}
              >
                <Button
                  size="sm"
                  onPress={() => {
                    setEditingHost(null)
                    setNewHostName('')
                    setNewHostSlug('')
                    setNewHostBio('')
                    setNewHostImageAsset(null)
                    setShowForm(true)
                  }}
                >
                  <Text>Add new host</Text>
                </Button>
              </View>
            ) : null}

            {showForm && (
              <>
                <Text className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">
                  {editingHost ? 'Edit host' : 'Add new host'}
                </Text>
                <Input
                  placeholder="Host name"
                  value={newHostName}
                  onChangeText={setNewHostName}
                  className="dark:bg-neutral-800 dark:text-neutral-100"
                />
                <Input
                  placeholder="Slug"
                  value={newHostSlug}
                  onChangeText={setNewHostSlug}
                  className="mt-2 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <Textarea
                  placeholder="Bio"
                  value={newHostBio}
                  onChangeText={setNewHostBio}
                  className="mt-2 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  {newHostImageAsset ? (
                    <ExpoImage
                      source={{ uri: newHostImageAsset.uri }}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 6,
                        marginRight: 8,
                      }}
                      contentFit="contain"
                    />
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={pickNewHostImage}
                  >
                    <Text>
                      {editingHost
                        ? 'Change Image'
                        : newHostImageAsset
                          ? 'Change Image'
                          : 'Pick Image'}
                    </Text>
                  </Button>
                </View>
                <View
                  style={{
                    marginTop: 12,
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Button
                    size="sm"
                    onPress={editingHost ? handleSaveHost : handleCreateHost}
                    disabled={editingHost ? updatingHost : creatingHost}
                  >
                    {editingHost ? (
                      updatingHost ? (
                        <View className="flex-row items-center gap-1">
                          <ActivityIndicator
                            size="small"
                            color={isDarkColorScheme ? '#1a1a1a' : '#fff'}
                          />
                          <Text>Saving...</Text>
                        </View>
                      ) : (
                        <Text>Save Changes</Text>
                      )
                    ) : creatingHost ? (
                      <View className="flex-row items-center gap-1">
                        <ActivityIndicator
                          size="small"
                          color={isDarkColorScheme ? '#1a1a1a' : '#fff'}
                        />
                        <Text>Creating...</Text>
                      </View>
                    ) : (
                      <Text>Create Host</Text>
                    )}
                  </Button>
                  {editingHost ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onPress={() => {
                        setEditingHost(null)
                        setNewHostName('')
                        setNewHostSlug('')
                        setNewHostBio('')
                        setNewHostImageAsset(null)
                        setShowForm(false)
                      }}
                    >
                      <Text>Cancel Edit</Text>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onPress={() => {
                        setEditingHost(null)
                        setNewHostName('')
                        setNewHostSlug('')
                        setNewHostBio('')
                        setNewHostImageAsset(null)
                        setShowForm(false)
                      }}
                    >
                      <Text>Cancel Add</Text>
                    </Button>
                  )}
                </View>
              </>
            )}
          </View>
          {/* Named PortalHost so AlertDialog within this modal renders above it on both web and native */}
          <PortalHost name="host-manager-modal" />
        </View>
      </View>
    </Modal>
  )
}
