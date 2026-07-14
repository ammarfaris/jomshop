import { useState, useEffect, useCallback } from 'react'
import {
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  useColorScheme,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Badge } from 'app/components/ui/badge'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from 'app/components/ui/alert-dialog'
import { toast } from 'app/lib/sonner-universal'
import {
  listSupabaseDraftContests,
  deleteSupabaseContest,
  type ContestSearchResult,
} from 'app/lib/supabase/admin'
import { TrashOutline } from 'app/components/icons-svg/TrashOutline'

type Props = {
  containerMaxWidth: number
  // Switch the admin screen to the Edit tab with this slug pre-filled, so the
  // admin can review and publish the draft in one flow.
  onOpenInEditTab: (slug: string) => void
}

type DraftContest = {
  $id: string
  slug: string
  title: string
  title_ms?: string | null
  summary?: string | null
  start_date?: string | null
  end_date?: string | null
  total_prizes_value_rm?: number | null
  $createdAt?: string | null
}

type DraftHost = { $id: string; name: string }

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRange(start?: string | null, end?: string | null): string {
  const s = start ? new Date(start) : null
  const e = end ? new Date(end) : null
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime()))
    return `${fmt(s)} – ${fmt(e)}`
  if (s && !isNaN(s.getTime())) return `from ${fmt(s)}`
  if (e && !isNaN(e.getTime())) return `until ${fmt(e)}`
  return '—'
}

export default function DraftsTabContent({
  containerMaxWidth,
  onOpenInEditTab,
}: Props) {
  const colorScheme = useColorScheme()
  const [drafts, setDrafts] = useState<DraftContest[]>([])
  const [hostsByContest, setHostsByContest] = useState<
    Record<string, DraftHost[]>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DraftContest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDrafts = useCallback(async () => {
    setIsLoading(true)
    try {
      const result: ContestSearchResult = await listSupabaseDraftContests()
      setDrafts((result.contests ?? []) as unknown as DraftContest[])
      const hostMap: Record<string, DraftHost[]> = {}
      for (const [cid, hosts] of Object.entries(result.hostsByContest ?? {})) {
        hostMap[cid] = (hosts as unknown as DraftHost[]).map((h) => ({
          $id: h.$id,
          name: h.name,
        }))
      }
      setHostsByContest(hostMap)
    } catch (error) {
      console.error('Failed to load drafts:', error)
      toast.error('Failed to load drafts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  const handleDeleteClick = (draft: DraftContest) => {
    setDeletingItem(draft)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingItem || isDeleting) return
    setIsDeleting(true)
    const loadingToastId = toast.loading('Deleting draft…')
    try {
      await deleteSupabaseContest(deletingItem.$id)
      toast.dismiss(loadingToastId)
      toast.success(`Deleted “${deletingItem.title || deletingItem.slug}”`)
      setDeleteDialogOpen(false)
      setDeletingItem(null)
      await loadDrafts()
    } catch (error) {
      toast.dismiss(loadingToastId)
      console.error('Delete error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete draft',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ScrollView
      className="flex-1 p-4"
      contentContainerStyle={{
        maxWidth: containerMaxWidth,
        width: '100%',
        alignSelf: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-6">
        {/* Header */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold">Drafts</Text>
            <Button
              variant="outline"
              size="sm"
              onPress={loadDrafts}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-xs">Refresh</Text>
              )}
            </Button>
          </View>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Contests ingested by the AI (or any path) at
            visibility=admin — invisible to users until you review and publish
            them in the Edit tab.
          </Text>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" />
          </View>
        ) : drafts.length === 0 ? (
          <View className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 items-center">
            <Text className="text-3xl mb-3">🎉</Text>
            <Text className="text-gray-700 dark:text-gray-300 font-semibold text-center">
              No drafts awaiting review
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              Ingested contests land here automatically. Run the
              direct-prompting or AutoClaw flow to create one.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {drafts.map((draft) => (
              <DraftCard
                key={draft.$id}
                draft={draft}
                hosts={hostsByContest[draft.$id] ?? []}
                onOpenInEditTab={onOpenInEditTab}
                onDelete={handleDeleteClick}
              />
            ))}
          </View>
        )}

        {/* Count footer */}
        {!isLoading && drafts.length > 0 && (
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {drafts.length} draft{drafts.length === 1 ? '' : 's'} • newest first
            {drafts.length >= 100 ? ' • showing latest 100' : ''}
          </Text>
        )}
      </View>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem && (
                <Text className="text-sm text-muted-foreground">
                  This permanently deletes “{deletingItem.title || deletingItem.slug}”
                  and any gallery files already uploaded. Cannot be undone.
                </Text>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} disabled={isDeleting}>
              <Text>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  )
}

function DraftCard({
  draft,
  hosts,
  onOpenInEditTab,
  onDelete,
}: {
  draft: DraftContest
  hosts: DraftHost[]
  onOpenInEditTab: (slug: string) => void
  onDelete: (draft: DraftContest) => void
}) {
  return (
    <View className="border border-border rounded-lg p-4 bg-white dark:bg-gray-900">
      {/* Title + actions */}
      <View className="flex-row items-start justify-between gap-3 mb-2">
        <View className="flex-1">
          <Text className="font-bold text-base" selectable>
            {draft.title || '(untitled)'}
          </Text>
          {draft.title_ms && draft.title_ms !== draft.title && (
            <Text className="text-sm text-gray-600 dark:text-gray-400" selectable>
              {draft.title_ms}
            </Text>
          )}
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onOpenInEditTab(draft.slug)}
            className="bg-main px-3 py-1.5 rounded"
          >
            <Text className="text-white text-xs font-semibold">Review</Text>
          </Pressable>
          <Pressable
            onPress={() => onDelete(draft)}
            className="bg-red-500 px-2.5 py-1.5 rounded"
            accessibilityLabel="Delete draft"
          >
            <TrashOutline width={14} height={14} />
          </Pressable>
        </View>
      </View>

      {/* Meta row */}
      <View className="flex-row flex-wrap gap-2 mb-3">
        <Badge variant="secondary">
          <Text className="text-xs">{formatRange(draft.start_date, draft.end_date)}</Text>
        </Badge>
        {typeof draft.total_prizes_value_rm === 'number' && (
          <Badge variant="secondary">
            <Text className="text-xs">
              RM{draft.total_prizes_value_rm.toLocaleString()}
            </Text>
          </Badge>
        )}
        {hosts.length > 0 && (
          <Badge variant="secondary">
            <Text className="text-xs">
              {hosts.map((h) => h.name).join(' · ')}
            </Text>
          </Badge>
        )}
      </View>

      {/* Summary (if any) */}
      {draft.summary ? (
        <Text className="text-sm text-gray-700 dark:text-gray-300 mb-2" numberOfLines={3}>
          {draft.summary}
        </Text>
      ) : (
        <Text className="text-sm text-gray-400 dark:text-gray-500 italic mb-2">
          No summary
        </Text>
      )}

      {/* Footer: slug + created */}
      <View className="border-t border-gray-200 dark:border-gray-700 pt-2 flex-row items-center justify-between gap-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400 font-mono" selectable>
          {draft.slug}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {draft.$createdAt ? `ingested ${formatDate(draft.$createdAt)}` : ''}
        </Text>
      </View>
    </View>
  )
}
