import { useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Image as ExpoImage } from 'expo-image'

import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Badge } from 'app/components/ui/badge'
import { toast } from 'app/lib/sonner-universal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'app/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'app/components/ui/alert-dialog'
import HostManagerModal from 'app/features/admin/HostManagerModal'
import CategoryManagerModal from 'app/features/admin/CategoryManagerModal'
import {
  listSupabaseContestFilesForEdit,
  type AdminContestFileInfo,
  type ContestImageChanges,
} from 'app/lib/supabase/admin'
import { EditPencil, SharedBadge } from './AdminEditableField'

// ---------------------------------------------------------------------------
// Admin-only contest metadata editors for the detail page's Edit Both mode:
// visibility (with confirmation + publish checks), categories, hosts, and the
// image gallery. All of these are contest-level (shared across EN/BM).
// ---------------------------------------------------------------------------

export type ContestVisibility = 'any' | 'users' | 'admin'

const VISIBILITY_LABELS: Record<ContestVisibility, string> = {
  any: 'Any (Public)',
  users: 'Users (Logged-in)',
  admin: 'Admin Only',
}

/**
 * Visibility dropdown for the detail-page header. Picking a new value opens a
 * confirmation dialog; making a contest visible beyond admins is blocked while
 * any required field (per createContestSchema) is still missing.
 */
export function AdminVisibilitySelect({
  value,
  missingRequiredFields,
  onSave,
}: {
  value: ContestVisibility
  /** Required-field gaps that block publishing (target 'users' or 'any'). */
  missingRequiredFields: string[]
  onSave: (next: ContestVisibility) => Promise<void>
}) {
  const [pending, setPending] = useState<ContestVisibility | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isPublishing = pending !== null && pending !== 'admin'
  const blocked = isPublishing && missingRequiredFields.length > 0

  const handleConfirm = async () => {
    if (!pending || isSaving || blocked) return
    setIsSaving(true)
    try {
      await onSave(pending)
      toast.success(`Visibility changed to ${VISIBILITY_LABELS[pending]}`)
      setPending(null)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to change visibility',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Select
        value={{ value, label: VISIBILITY_LABELS[value] }}
        onValueChange={(option) => {
          const next = option?.value as ContestVisibility | undefined
          if (!next || next === value) return
          setPending(next)
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="Visibility" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(VISIBILITY_LABELS) as ContestVisibility[]).map((v) => (
            <SelectItem key={v} value={v} label={VISIBILITY_LABELS[v]}>
              {VISIBILITY_LABELS[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change visibility?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `This contest will change from "${VISIBILITY_LABELS[value]}" to "${VISIBILITY_LABELS[pending]}".`
                : ''}
              {isPublishing && !blocked
                ? ' All required fields are filled in.'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {blocked && (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-red-600 dark:text-red-400">
                Cannot publish yet — missing required fields:
              </Text>
              {missingRequiredFields.map((field) => (
                <Text
                  key={field}
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  • {field}
                </Text>
              ))}
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Fill these in (Edit Both mode) before making the contest
                visible to users.
              </Text>
            </View>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <Button onPress={handleConfirm} disabled={isSaving || blocked}>
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text>Confirm</Text>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Categories row for the edit strip: current category badges plus a pencil
 * that opens the shared CategoryManagerModal. The selection is saved when the
 * modal closes (only if it actually changed).
 */
export function AdminCategoriesEditor({
  categories,
  requireNonEmpty,
  onSave,
}: {
  categories: Array<{ $id: string; name_en: string }>
  /** Published contests must keep ≥1 category — an empty selection is discarded. */
  requireNonEmpty?: boolean
  onSave: (categoryIds: string[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const handleClose = async () => {
    setOpen(false)
    const originalIds = categories.map((c) => c.$id)
    const changed =
      draftIds.length !== originalIds.length ||
      draftIds.some((id) => !originalIds.includes(id))
    if (!changed) return
    if (requireNonEmpty && draftIds.length === 0) {
      toast.error(
        'A published contest needs at least one category — selection not saved',
      )
      return
    }
    setIsSaving(true)
    try {
      await onSave(draftIds)
      toast.success('Categories saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save categories')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <View className="flex-row items-center gap-2 flex-wrap">
      <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
        Categories:
      </Text>
      {categories.length > 0 ? (
        categories.map((c) => (
          <Badge
            key={c.$id}
            variant="outline"
            className="bg-gray-50 border-gray-300 dark:bg-neutral-900 dark:border-neutral-700"
          >
            <Text className="text-xs text-gray-700 dark:text-neutral-200">
              {c.name_en}
            </Text>
          </Badge>
        ))
      ) : (
        <Text className="text-xs italic text-gray-400 dark:text-gray-500">
          No categories yet
        </Text>
      )}
      {isSaving ? (
        <ActivityIndicator size="small" />
      ) : (
        <EditPencil
          label="Categories"
          onPress={() => {
            setDraftIds(categories.map((c) => c.$id))
            setOpen(true)
          }}
        />
      )}
      <CategoryManagerModal
        visible={open}
        selectedCategoryIds={draftIds}
        onChangeSelection={(ids) => setDraftIds(ids)}
        onRequestClose={handleClose}
      />
    </View>
  )
}

/**
 * Hosts pencil for the host-images row: opens the shared HostManagerModal and
 * saves the selection when the modal closes (only if it actually changed).
 */
export function AdminHostsEditor({
  hosts,
  requireNonEmpty,
  onSave,
}: {
  hosts: Array<{ $id: string }>
  /** Published contests must keep ≥1 host — an empty selection is discarded. */
  requireNonEmpty?: boolean
  onSave: (hostIds: string[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const handleClose = async () => {
    setOpen(false)
    const originalIds = hosts.map((h) => h.$id)
    const changed =
      draftIds.length !== originalIds.length ||
      draftIds.some((id) => !originalIds.includes(id))
    if (!changed) return
    if (requireNonEmpty && draftIds.length === 0) {
      toast.error(
        'A published contest needs at least one host — selection not saved',
      )
      return
    }
    setIsSaving(true)
    try {
      await onSave(draftIds)
      toast.success('Hosts saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save hosts')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {isSaving ? (
        <ActivityIndicator size="small" />
      ) : (
        <EditPencil
          label="Hosts"
          onPress={() => {
            setDraftIds(hosts.map((h) => h.$id))
            setOpen(true)
          }}
        />
      )}
      <HostManagerModal
        visible={open}
        selectedHostIds={draftIds}
        onChangeSelection={(ids) => setDraftIds(ids)}
        onRequestClose={handleClose}
      />
    </>
  )
}

/**
 * Inline gallery editor: remove existing images, add new ones, and pick the
 * main image. Renders as a compact "Images" row with a pencil; editing expands
 * a panel. Existing files are loaded on open (with storage paths — the detail
 * payload only carries public URLs).
 */
export function AdminImagesEditor({
  contestId,
  slugBase,
  imageCount,
  onSave,
}: {
  contestId: string
  /** Basename for new uploads (the contest slug). */
  slugBase: string
  /** Current gallery size, for the collapsed row. */
  imageCount: number
  onSave: (
    contestId: string,
    slugBase: string,
    changes: ContestImageChanges,
  ) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [files, setFiles] = useState<AdminContestFileInfo[]>([])
  const [toDelete, setToDelete] = useState<Set<string>>(new Set())
  const [newAssets, setNewAssets] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [mainPath, setMainPath] = useState<string | null>(null)
  const [newMainUri, setNewMainUri] = useState<string | null>(null)

  const openEditor = async () => {
    setOpen(true)
    setIsLoading(true)
    try {
      const loaded = await listSupabaseContestFilesForEdit(contestId)
      setFiles(loaded)
      setToDelete(new Set())
      setNewAssets([])
      setMainPath(
        loaded.find((f) => f.isMain)?.storagePath ??
          loaded[0]?.storagePath ??
          null,
      )
      setNewMainUri(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load images')
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDelete = (storagePath: string) => {
    setToDelete((prev) => {
      const next = new Set(prev)
      if (next.has(storagePath)) next.delete(storagePath)
      else next.add(storagePath)
      return next
    })
  }

  const handlePickImages = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        toast.error('Sorry, we need camera roll permissions to upload images.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 1,
      })
      if (!result.canceled && result.assets) {
        setNewAssets((prev) =>
          [...prev, ...result.assets].filter(
            (v, i, arr) => arr.findIndex((x) => x.uri === v.uri) === i,
          ),
        )
      }
    } catch {
      toast.error('Failed to pick images. Please try again.')
    }
  }

  const remainingCount =
    files.filter((f) => !toDelete.has(f.storagePath)).length + newAssets.length

  const handleSave = async () => {
    if (isSaving) return
    if (remainingCount === 0) {
      toast.error('At least one contest image is required')
      return
    }
    setIsSaving(true)
    try {
      await onSave(contestId, slugBase, {
        imagesToDelete: Array.from(toDelete),
        newGalleryAssets: newAssets,
        mainImageId:
          mainPath && !toDelete.has(mainPath) ? mainPath : null,
        newMainImageUri: newMainUri,
      })
      toast.success('Contest images saved')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save images')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) {
    return (
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Images: {imageCount}
        </Text>
        <EditPencil label="Contest images" onPress={openEditor} />
      </View>
    )
  }

  return (
    <View className="gap-3 rounded-md border border-main/40 bg-main/5 p-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Contest images
        </Text>
        <SharedBadge />
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-3">
            {files.map((f) => {
              const removed = toDelete.has(f.storagePath)
              const isMain =
                !removed && !newMainUri && mainPath === f.storagePath
              return (
                <View key={f.id} style={{ width: 96 }}>
                  <View
                    className={`rounded-md overflow-hidden border-2 ${
                      isMain
                        ? 'border-main'
                        : removed
                          ? 'border-red-400'
                          : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{ opacity: removed ? 0.4 : 1 }}
                  >
                    <ExpoImage
                      source={{ uri: f.url }}
                      style={{ width: 92, height: 92 }}
                      contentFit="cover"
                    />
                  </View>
                  {isMain && (
                    <Text className="text-[10px] font-semibold text-center text-main">
                      Main
                    </Text>
                  )}
                  <View className="flex-row justify-center gap-3 mt-1">
                    {!removed && !isMain && (
                      <Pressable
                        onPress={() => {
                          setMainPath(f.storagePath)
                          setNewMainUri(null)
                        }}
                      >
                        <Text className="text-[11px] text-main font-medium">
                          Set main
                        </Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => toggleDelete(f.storagePath)}>
                      <Text className="text-[11px] text-red-500 font-medium">
                        {removed ? 'Undo' : 'Remove'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}

            {newAssets.map((asset) => {
              const isMain = newMainUri === asset.uri
              return (
                <View key={asset.uri} style={{ width: 96 }}>
                  <View
                    className={`rounded-md overflow-hidden border-2 ${
                      isMain ? 'border-main' : 'border-dashed border-main/50'
                    }`}
                  >
                    <ExpoImage
                      source={{ uri: asset.uri }}
                      style={{ width: 92, height: 92 }}
                      contentFit="cover"
                    />
                  </View>
                  <Text className="text-[10px] text-center text-gray-500 dark:text-gray-400">
                    {isMain ? 'Main · New' : 'New'}
                  </Text>
                  <View className="flex-row justify-center gap-3 mt-1">
                    {!isMain && (
                      <Pressable onPress={() => setNewMainUri(asset.uri)}>
                        <Text className="text-[11px] text-main font-medium">
                          Set main
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => {
                        setNewAssets((prev) =>
                          prev.filter((a) => a.uri !== asset.uri),
                        )
                        if (isMain) setNewMainUri(null)
                      }}
                    >
                      <Text className="text-[11px] text-red-500 font-medium">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>

          <Text className="text-xs text-gray-500 dark:text-gray-400">
            The main image is used as the contest cover. Removals are applied
            when you save.
          </Text>

          <View className="flex-row items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={handlePickImages}
              disabled={isSaving}
            >
              <Text>Add images</Text>
            </Button>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setOpen(false)}
                disabled={isSaving}
              >
                <Text>Cancel</Text>
              </Button>
              <Button size="sm" onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text>Save</Text>
                )}
              </Button>
            </View>
          </View>
        </>
      )}
    </View>
  )
}
