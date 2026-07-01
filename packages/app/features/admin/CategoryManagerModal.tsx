import { useEffect, useMemo, useState, useRef } from 'react'
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
import type { Document } from 'app/lib/types'
import {
  listSupabaseCategories,
  createSupabaseCategory,
  updateSupabaseCategory,
  deleteSupabaseCategory,
  findSupabaseContestsUsingCategory,
} from 'app/lib/supabase/admin'
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
import { RadioGroup, RadioGroupItem } from 'app/components/ui/radio-group'
import { Label } from 'app/components/ui/label'

export type CategoryDoc = Document & {
  slug: string
  name_en: string
  name_ms: string
  priority_order?: number
  type?: 'prize' | 'winner_selection' | 'how_to_enter' | 'business_category'
  created_by?: string
  updated_by?: string
}

export default function CategoryManagerModal(props: {
  visible: boolean
  selectedCategoryIds: string[]
  onChangeSelection: (ids: string[], categories: CategoryDoc[]) => void
  onRequestClose: () => void
}) {
  const { visible, selectedCategoryIds, onChangeSelection, onRequestClose } =
    props
  const { user } = useAuth()
  const { isDarkColorScheme } = useColorScheme()

  // Responsive modal width: min(700px, 94vw). On small web screens, use full width.
  const vw = Dimensions.get('window').width
  const isSmallWeb = Platform.OS === 'web' && vw <= 480
  const containerWidth = isSmallWeb
    ? Math.round(vw)
    : Math.min(700, Math.round(vw * 0.94))

  const [allCategories, setAllCategories] = useState<CategoryDoc[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  // Create / edit form
  const [newSlug, setNewSlug] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [newNameMs, setNewNameMs] = useState('')
  const [newPriorityOrder, setNewPriorityOrder] = useState('')
  const [newType, setNewType] = useState<
    'prize' | 'winner_selection' | 'how_to_enter' | 'business_category'
  >('prize')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CategoryDoc | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Search & list control
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['prize'])

  // Ref for scrolling to form on web
  const formSectionRef = useRef<View>(null)

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const fetchCategories = async (): Promise<CategoryDoc[]> => {
    return (await listSupabaseCategories()) as unknown as CategoryDoc[]
  }

  useEffect(() => {
    // Always sync slug with English name (matches HostManagerModal behavior)
    if (!newNameEn) setNewSlug('')
    else setNewSlug(slugify(newNameEn))
  }, [newNameEn])

  // Load categories on open
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      setCategoriesLoading(true)
      setCategoriesError(null)
      try {
        const rows = await fetchCategories()
        if (!cancelled) setAllCategories(rows)
      } catch (e: any) {
        if (!cancelled)
          setCategoriesError(e?.message || 'Failed to load categories')
      } finally {
        if (!cancelled) setCategoriesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  const filteredCategories = useMemo(() => {
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

    // First filter by selected types
    const typeFiltered = allCategories.filter((c) =>
      selectedTypes.includes(c.type || 'prize')
    )

    if (q) {
      const matches = typeFiltered.filter(
        (c) =>
          (c.name_en || '').toLowerCase().includes(q) ||
          (c.name_ms || '').toLowerCase().includes(q) ||
          (c.slug || '').toLowerCase().includes(q)
      )
      return matches.sort((a, b) => toTime(b) - toTime(a))
    }

    // Not searching: show selected first, then most recent others
    const byId = new Map(typeFiltered.map((c) => [c.$id, c]))
    const selectedDocs = selectedCategoryIds
      .map((id) => byId.get(id))
      .filter(Boolean) as CategoryDoc[]
    const selectedSet = new Set(selectedCategoryIds)
    const restSorted = [...typeFiltered]
      .filter((c) => !selectedSet.has(c.$id))
      .sort((a, b) => toTime(b) - toTime(a))
    const rest = !showAll ? restSorted.slice(0, limit) : restSorted

    return [...selectedDocs, ...rest]
  }, [search, allCategories, selectedCategoryIds, showAll, selectedTypes])

  const toggleSelected = (categoryId: string) => {
    const nextIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId]
    const byId = new Map(allCategories.map((c) => [c.$id, c]))
    const nextDocs = nextIds
      .map((id) => byId.get(id))
      .filter(Boolean) as CategoryDoc[]
    onChangeSelection(nextIds, nextDocs)
    setShowForm(false)
  }

  // Only allow non-negative integer input (strip all non-digits)
  const onChangePriorityOrder = (txt: string) => {
    const digitsOnly = txt.replace(/[^0-9]/g, '')
    setNewPriorityOrder(digitsOnly)
  }

  const startEdit = (cat: CategoryDoc) => {
    setEditing(cat)
    setNewSlug(cat.slug)
    setNewNameEn(cat.name_en)
    setNewNameMs(cat.name_ms)
    setNewPriorityOrder(
      cat.priority_order === undefined || cat.priority_order === null
        ? ''
        : String(cat.priority_order)
    )
    setNewType(cat.type || 'prize')
    setShowForm(true)

    // Scroll to form on web after a short delay to ensure form is rendered
    if (Platform.OS === 'web') {
      setTimeout(() => {
        if (formSectionRef.current) {
          ;(formSectionRef.current as any).scrollIntoView?.({
            behavior: 'smooth',
            block: 'start',
          })
        }
      }, 100)
    }
  }

  const handleCreate = async () => {
    if (!user) return
    if (!newSlug.trim() || !newNameEn.trim() || !newNameMs.trim()) {
      alert('Please provide slug, English and Malay names')
      return
    }
    setCreating(true)
    try {
      const priority = Number.parseInt(newPriorityOrder || '0', 10) || 0
      await createSupabaseCategory({
        slug: newSlug.trim(),
        name_en: newNameEn.trim(),
        name_ms: newNameMs.trim(),
        priority_order: priority,
        type: newType,
      })

      // reset
      setNewSlug('')
      setNewNameEn('')
      setNewNameMs('')
      setNewPriorityOrder('')
      setNewType('prize')

      // refresh
      try {
        setAllCategories(await fetchCategories())
      } catch {}
      setShowForm(false)
    } catch (e: any) {
      alert('Failed to create category: ' + (e?.message || 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    if (!user || !editing) return
    if (!newSlug.trim() || !newNameEn.trim() || !newNameMs.trim()) {
      alert('Please provide slug, English and Malay names')
      return
    }
    setUpdating(true)
    try {
      const priority = Number.parseInt(newPriorityOrder || '0', 10) || 0
      await updateSupabaseCategory(editing.$id, {
        slug: newSlug.trim(),
        name_en: newNameEn.trim(),
        name_ms: newNameMs.trim(),
        priority_order: priority,
        type: newType,
      })

      // refresh & propagate to parent selection
      try {
        const updatedAll = await fetchCategories()
        setAllCategories(updatedAll)
        if (selectedCategoryIds.length > 0) {
          const byId = new Map(updatedAll.map((c) => [c.$id, c]))
          const nextDocs = selectedCategoryIds
            .map((id) => byId.get(id))
            .filter(Boolean) as CategoryDoc[]
          onChangeSelection(selectedCategoryIds, nextDocs)
        }
      } catch {}

      setEditing(null)
      setNewSlug('')
      setNewNameEn('')
      setNewNameMs('')
      setNewPriorityOrder('')
      setNewType('prize')
      setShowForm(false)
    } catch (e: any) {
      alert('Failed to save category: ' + (e?.message || 'Unknown error'))
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    // Guard against deletion when contests reference this category
    try {
      const titles = await findSupabaseContestsUsingCategory(categoryId)
      if (titles.length > 0) {
        const list = titles.map((t) => `- ${t}`).join('\n')
        alert(
          `Cannot delete category. It is linked to ${titles.length} contest(s):\n${list}`
        )
        return
      }
    } catch (e: any) {
      alert(
        'Failed to verify category usage: ' + (e?.message || 'Unknown error')
      )
      return
    }

    setDeletingIds((prev) => {
      const next = new Set<string>()
      prev.forEach((v) => next.add(v))
      next.add(categoryId)
      return next
    })
    try {
      await deleteSupabaseCategory(categoryId)

      // refresh after deletion
      try {
        setAllCategories(await fetchCategories())
      } catch {}

      // update selection
      const nextIds = selectedCategoryIds.filter((id) => id !== categoryId)
      const byId = new Map(allCategories.map((c) => [c.$id, c]))
      const nextDocs = nextIds
        .map((id) => byId.get(id))
        .filter(Boolean) as CategoryDoc[]
      onChangeSelection(nextIds, nextDocs)
    } catch (e: any) {
      alert('Failed to delete category: ' + (e?.message || 'Unknown error'))
    } finally {
      setDeletingIds((prev) => {
        const next = new Set<string>()
        prev.forEach((v) => next.add(v))
        next.delete(categoryId)
        return next
      })
    }
  }

  return (
    <Modal
      animationType="none"
      transparent
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
                overflow: 'auto' as any,
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
                Select Category(s)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="mr-2"
                  disabled={selectedCategoryIds.length === 0}
                  onPress={() => {
                    onChangeSelection([], [])
                  }}
                >
                  <Text>Deselect all</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={categoriesLoading}
                  onPress={() => {
                    setCategoriesLoading(true)
                    setCategoriesError(null)
                    fetchCategories()
                      .then((rows) => setAllCategories(rows))
                      .catch((e) =>
                        setCategoriesError(
                          e?.message || 'Failed to refresh categories'
                        )
                      )
                      .finally(() => setCategoriesLoading(false))
                  }}
                >
                  <Text>{categoriesLoading ? '🔄' : '🔄'}</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2"
                  onPress={onRequestClose}
                >
                  <Text className="text-lg">✕</Text>
                </Button>
              </View>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Input
                placeholder="Search by English, Malay name or slug"
                value={search}
                onChangeText={setSearch}
                className="dark:bg-neutral-800 dark:text-neutral-100"
              />
            </View>

            {/* Type filter buttons */}
            <View style={{ marginBottom: 12 }}>
              <Text className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Filter by type:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant={
                    selectedTypes.includes('prize') ? 'default' : 'outline'
                  }
                  onPress={() => setSelectedTypes(['prize'])}
                >
                  <Text>Prize</Text>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedTypes.includes('winner_selection')
                      ? 'default'
                      : 'outline'
                  }
                  onPress={() => setSelectedTypes(['winner_selection'])}
                >
                  <Text>Winner Selection</Text>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedTypes.includes('how_to_enter')
                      ? 'default'
                      : 'outline'
                  }
                  onPress={() => setSelectedTypes(['how_to_enter'])}
                >
                  <Text>How to Enter</Text>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedTypes.includes('business_category')
                      ? 'default'
                      : 'outline'
                  }
                  onPress={() => setSelectedTypes(['business_category'])}
                >
                  <Text>Business Category</Text>
                </Button>
              </View>
            </View>

            {!search.trim() && allCategories.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {showAll
                    ? `Listing all ${filteredCategories.length} categories`
                    : selectedCategoryIds.length > 0
                    ? `Listing selected category and ${
                        Platform.OS === 'web'
                          ? 'up to 5 recently updated categories'
                          : 'up to 15 recently updated categories'
                      }`
                    : `Listing ${
                        Platform.OS === 'web'
                          ? 'up to 5 recently updated categories'
                          : 'up to 15 recently updated categories'
                      }`}
                </Text>
                {showAll ? (
                  <Pressable
                    onPress={() => setShowAll(false)}
                    style={{ marginLeft: 6, marginBottom: 8 }}
                  >
                    <Text className="text-sm text-blue-600 underline">
                      (list few)
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setShowAll(true)}
                    style={{ marginLeft: 6, marginBottom: 8 }}
                  >
                    <Text className="text-sm text-blue-600 underline">
                      (list all)
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {categoriesLoading ? (
              <ActivityIndicator color="grey" />
            ) : categoriesError ? (
              <Text className="text-red-400 dark:text-red-400 mb-2">
                {categoriesError}
              </Text>
            ) : allCategories.length === 0 ? (
              <Text className="text-gray-500 dark:text-gray-400 text-center py-4">
                There is no category to select, please add category below...
              </Text>
            ) : filteredCategories.length === 0 ? (
              <Text className="text-gray-500 dark:text-gray-400 text-center py-4">
                No categories match your search
              </Text>
            ) : Platform.OS === 'web' ? (
              <View>
                {filteredCategories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.$id)
                  return (
                    <View
                      key={c.$id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <Pressable
                        onPress={() => toggleSelected(c.$id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        accessibilityRole={
                          Platform.OS === 'web' ? ('button' as any) : undefined
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text className="text-black dark:text-neutral-100">
                            {c.name_en}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {c.name_ms}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            Slug:{c.slug}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            Type:{' '}
                            {c.type === 'prize'
                              ? 'Prize'
                              : c.type === 'winner_selection'
                              ? 'Winner Selection'
                              : c.type === 'how_to_enter'
                              ? 'How to Enter'
                              : c.type === 'business_category'
                              ? 'Business Category'
                              : 'Prize'}
                          </Text>
                        </View>
                      </Pressable>
                      <Button
                        variant={checked ? 'secondary' : 'outline'}
                        size="sm"
                        onPress={() => toggleSelected(c.$id)}
                      >
                        <Text>{checked ? '✅' : '☑️'}</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onPress={() => startEdit(c)}
                      >
                        <Text>Edit</Text>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            disabled={deletingIds.has(c.$id)}
                          >
                            {deletingIds.has(c.$id) ? (
                              <View className="flex-row items-center gap-1">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text>Deleting...</Text>
                              </View>
                            ) : (
                              <Text>Delete</Text>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent portalHost="category-manager-modal">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete category?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{c.name_en}". This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              <Text>Cancel</Text>
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onPress={() => handleDelete(c.$id)}
                            >
                              {deletingIds.has(c.$id) ? (
                                <View className="flex-row items-center gap-1">
                                  <ActivityIndicator size="small" color="#fff" />
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
                {filteredCategories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.$id)
                  return (
                    <View
                      key={c.$id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <Pressable
                        onPress={() => toggleSelected(c.$id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        accessibilityRole={
                          Platform.OS === 'web' ? ('button' as any) : undefined
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text className="text-black dark:text-neutral-100">
                            {c.name_en}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {c.name_ms}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {c.slug}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            Type:{' '}
                            {c.type === 'prize'
                              ? 'Prize'
                              : c.type === 'winner_selection'
                              ? 'Winner Selection'
                              : c.type === 'how_to_enter'
                              ? 'How to Enter'
                              : c.type === 'business_category'
                              ? 'Business Category'
                              : 'Prize'}
                          </Text>
                        </View>
                      </Pressable>
                      <Button
                        variant={checked ? 'secondary' : 'outline'}
                        size="sm"
                        onPress={() => toggleSelected(c.$id)}
                      >
                        <Text>{checked ? '✅' : '☑️'}</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onPress={() => startEdit(c)}
                      >
                        <Text>Edit</Text>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            disabled={deletingIds.has(c.$id)}
                          >
                            {deletingIds.has(c.$id) ? (
                              <View className="flex-row items-center gap-1">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text>Deleting...</Text>
                              </View>
                            ) : (
                              <Text>Delete</Text>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent portalHost="category-manager-modal">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete category?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{c.name_en}". This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              <Text>Cancel</Text>
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onPress={() => handleDelete(c.$id)}
                            >
                              {deletingIds.has(c.$id) ? (
                                <View className="flex-row items-center gap-1">
                                  <ActivityIndicator size="small" color="#fff" />
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

            {/* Create / Edit form toggle */}
            {!showForm ? (
              <View style={{ marginTop: 12 }}>
                <Button
                  size="sm"
                  onPress={() => {
                    setEditing(null)
                    setNewSlug('')
                    setNewNameEn('')
                    setNewNameMs('')
                    setNewPriorityOrder('')
                    setNewType('prize')
                    setShowForm(true)
                  }}
                >
                  <Text>Add new category</Text>
                </Button>
              </View>
            ) : (
              <View ref={formSectionRef} style={{ marginTop: 12 }}>
                <Text
                  className="text-base font-semibold text-black dark:text-neutral-100"
                  style={{ marginBottom: 6 }}
                >
                  {editing ? 'Edit category' : 'Add category'}
                </Text>
                <View style={{ gap: 8 }}>
                  <Input
                    placeholder="English name (name_en)"
                    value={newNameEn}
                    onChangeText={setNewNameEn}
                    className="dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <Input
                    placeholder="Malay name (name_ms)"
                    value={newNameMs}
                    onChangeText={setNewNameMs}
                    className="dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <Input
                    placeholder="Slug (unique)"
                    value={newSlug}
                    onChangeText={setNewSlug}
                    className="dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <Input
                    placeholder="Priority order (higher shows first; default 0)"
                    value={newPriorityOrder}
                    onChangeText={onChangePriorityOrder}
                    keyboardType={
                      Platform.OS === 'ios' ? 'number-pad' : 'numeric'
                    }
                    className="dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <View>
                    <Text className="text-sm text-black dark:text-neutral-100 mb-2">
                      Category Type
                    </Text>
                    <RadioGroup
                      value={newType}
                      onValueChange={(val) => {
                        if (
                          val === 'prize' ||
                          val === 'winner_selection' ||
                          val === 'how_to_enter' ||
                          val === 'business_category'
                        ) {
                          setNewType(val)
                        }
                      }}
                      className="gap-3"
                    >
                      <View className="flex-row items-center gap-2">
                        <RadioGroupItem
                          value="prize"
                          aria-labelledby="prize-label"
                        />
                        <Label
                          nativeID="prize-label"
                          onPress={() => setNewType('prize')}
                        >
                          Prize
                        </Label>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <RadioGroupItem
                          value="winner_selection"
                          aria-labelledby="winner-selection-label"
                        />
                        <Label
                          nativeID="winner-selection-label"
                          onPress={() => setNewType('winner_selection')}
                        >
                          Winner Selection
                        </Label>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <RadioGroupItem
                          value="how_to_enter"
                          aria-labelledby="how-to-enter-label"
                        />
                        <Label
                          nativeID="how-to-enter-label"
                          onPress={() => setNewType('how_to_enter')}
                        >
                          How to Enter
                        </Label>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <RadioGroupItem
                          value="business_category"
                          aria-labelledby="business-category-label"
                        />
                        <Label
                          nativeID="business-category-label"
                          onPress={() => setNewType('business_category')}
                        >
                          Business Category
                        </Label>
                      </View>
                    </RadioGroup>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  {editing ? (
                    <Button size="sm" onPress={handleSave} disabled={updating}>
                      {updating ? (
                        <View className="flex-row items-center gap-1">
                          <ActivityIndicator size="small" color={isDarkColorScheme ? '#1a1a1a' : '#fff'} />
                          <Text>Saving…</Text>
                        </View>
                      ) : (
                        <Text>Save</Text>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onPress={handleCreate}
                      disabled={creating}
                    >
                      {creating ? (
                        <View className="flex-row items-center gap-1">
                          <ActivityIndicator size="small" color={isDarkColorScheme ? '#1a1a1a' : '#fff'} />
                          <Text>Creating…</Text>
                        </View>
                      ) : (
                        <Text>Create</Text>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2"
                    onPress={() => {
                      setEditing(null)
                      setNewSlug('')
                      setNewNameEn('')
                      setNewNameMs('')
                      setNewPriorityOrder('')
                      setNewType('prize')
                      setShowForm(false)
                    }}
                  >
                    <Text>Cancel</Text>
                  </Button>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
      {/* Portal for nested dialogs */}
      <PortalHost name="category-manager-modal" />
    </Modal>
  )
}
