import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Textarea } from 'app/components/ui/textarea'
import { PencilOutline } from 'app/components/icons-svg/PencilOutline'
import SingleDateTimePicker from 'app/components/SingleDateTimePicker'
import SingleDateTimePickerMobile from 'app/components/SingleDateTimePickerMobile'
import { toast } from 'app/lib/sonner-universal'
import {
  updateSupabaseContestFields,
  updateSupabaseTranslationField,
  type ContestInlinePatch,
  type TranslationInlineField,
} from 'app/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Admin-only inline editing on the contest detail page. Each editable item
// renders its normal display plus a small pencil button; tapping it swaps in
// a field editor with Save/Cancel. Saves patch a single column and then
// invalidate the detail query so the page re-renders with fresh data.
// Non-admins never see any of this — `enabled={false}` renders children as-is.
// ---------------------------------------------------------------------------

/**
 * Save functions for the detail page's inline edits, pre-wired to invalidate
 * the `usePublicContestBySlug` cache (prefix match covers all auth variants).
 */
export function useAdminInlineContestSave(slug: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['public-contest', 'supabase', slug],
    })

  const saveContestFields = async (
    contestId: string,
    patch: ContestInlinePatch,
  ) => {
    await updateSupabaseContestFields(contestId, patch)
    await invalidate()
  }

  const saveTranslationField = async (
    contestId: string,
    locale: 'en' | 'ms',
    field: TranslationInlineField,
    value: string,
  ) => {
    await updateSupabaseTranslationField(contestId, locale, field, value)
    await invalidate()
  }

  return { saveContestFields, saveTranslationField }
}

type AdminEditableFieldProps = {
  /** Whether inline editing is available (i.e. the viewer is an admin). */
  enabled: boolean
  /** Shown in the editor header, toasts, and the empty placeholder. */
  label: string
  /** Current raw value — seeds the editor when the pencil is tapped. */
  value: string | null | undefined
  onSave: (value: string) => Promise<void>
  multiline?: boolean
  /** Extra hint rendered under the editor (e.g. expected format). */
  hint?: string
  /**
   * Character limit (mirrors createContestSchema). Enforced on the input and
   * rendered as a live counter like the admin edit-contest form.
   */
  maxLength?: number
  /**
   * Locale-independent contest field (dates, prize value, social links):
   * flags in the editor that saving affects both EN and BM views.
   */
  shared?: boolean
  /** Normal display rendering; a placeholder is shown when absent. */
  children?: React.ReactNode
}

export function AdminEditableField({
  enabled,
  label,
  value,
  onSave,
  multiline = true,
  hint,
  maxLength,
  shared,
  children,
}: AdminEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!enabled) return <>{children ?? null}</>

  if (!isEditing) {
    return (
      <View className="flex-row items-start gap-2">
        <View className="flex-1" style={{ minWidth: 0 }}>
          {children ?? (
            <Text className="text-sm italic text-gray-400 dark:text-gray-500">
              No {label.toLowerCase()} yet
            </Text>
          )}
        </View>
        <EditPencil
          label={label}
          onPress={() => {
            setDraft(value ?? '')
            setIsEditing(true)
          }}
        />
      </View>
    )
  }

  const isOverLimit = maxLength !== undefined && draft.length > maxLength

  const handleSave = async () => {
    if (isSaving) return
    if (isOverLimit) {
      toast.error(`${label} exceeds the ${maxLength} character limit`)
      return
    }
    setIsSaving(true)
    try {
      await onSave(draft)
      toast.success(`${label} saved`)
      setIsEditing(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to save ${label}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <View
      className="gap-2 rounded-md border border-main/40 bg-main/5 p-2"
      style={{ minWidth: multiline ? undefined : 240 }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          {label}
        </Text>
        {shared && <SharedBadge />}
      </View>
      {multiline ? (
        <Textarea
          value={draft}
          onChangeText={setDraft}
          autoFocus
          maxLength={maxLength}
        />
      ) : (
        <Input
          value={draft}
          onChangeText={setDraft}
          autoFocus
          maxLength={maxLength}
        />
      )}
      {maxLength !== undefined && (
        <Text
          className={`text-xs text-right ${
            isOverLimit
              ? 'text-red-500 dark:text-red-400'
              : draft.length > maxLength * 0.9
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-muted-foreground'
          }`}
        >
          {draft.length}/{maxLength} ·{' '}
          {Math.max(0, maxLength - draft.length)} left
        </Text>
      )}
      {hint && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">{hint}</Text>
      )}
      <View className="flex-row justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={() => setIsEditing(false)}
          disabled={isSaving}
        >
          <Text>Cancel</Text>
        </Button>
        <Button size="sm" onPress={handleSave} disabled={isSaving || isOverLimit}>
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Save</Text>
          )}
        </Button>
      </View>
    </View>
  )
}

function SharedBadge() {
  return (
    <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
      Shared · applies to EN & BM
    </Text>
  )
}

function EditPencil({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800"
      accessibilityLabel={`Edit ${label}`}
      accessibilityRole="button"
    >
      <PencilOutline
        width={14}
        height={14}
        className="text-gray-600 dark:text-gray-300"
      />
    </Pressable>
  )
}

type AdminEditableDateRangeProps = {
  enabled: boolean
  /** ISO timestamps from the contest row. */
  startValue: string | null | undefined
  endValue: string | null | undefined
  onSave: (startIso: string, endIso: string) => Promise<void>
  /** The read-only dates row. */
  children: React.ReactNode
}

/**
 * One pencil for the whole Start/End dates row. Editing opens a full-width
 * panel with the same date+time pickers as the admin portal forms — the
 * pickers convert ISO ⇄ local wall-clock time, so a contest starting
 * 1 Jul 00:00 MYT edits as exactly that (not the UTC date), and the two
 * editors can never overlap like per-column ones did in the Both view.
 */
export function AdminEditableDateRange({
  enabled,
  startValue,
  endValue,
  onSave,
  children,
}: AdminEditableDateRangeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!enabled) return <>{children}</>

  if (!isEditing) {
    return (
      <View className="flex-row items-start gap-2">
        <View className="flex-1" style={{ minWidth: 0 }}>
          {children}
        </View>
        <EditPencil
          label="Contest dates"
          onPress={() => {
            setStartDraft(startValue ?? '')
            setEndDraft(endValue ?? '')
            setIsEditing(true)
          }}
        />
      </View>
    )
  }

  const handleSave = async () => {
    if (isSaving) return
    if (!startDraft || !endDraft) {
      toast.error('Both start and end date/time are required')
      return
    }
    if (new Date(endDraft) <= new Date(startDraft)) {
      toast.error('End date must be after the start date')
      return
    }
    setIsSaving(true)
    try {
      await onSave(
        new Date(startDraft).toISOString(),
        new Date(endDraft).toISOString(),
      )
      toast.success('Contest dates saved')
      setIsEditing(false)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to save contest dates',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const Picker =
    Platform.OS === 'web' ? SingleDateTimePicker : SingleDateTimePickerMobile

  return (
    <View className="gap-2 rounded-md border border-main/40 bg-main/5 p-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Contest dates
        </Text>
        <SharedBadge />
      </View>
      <View className="flex-row flex-wrap gap-4">
        <View className="gap-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Start date & time
          </Text>
          <Picker value={startDraft} onChange={setStartDraft} />
        </View>
        <View className="gap-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            End date & time
          </Text>
          <Picker value={endDraft} onChange={setEndDraft} />
        </View>
      </View>
      <View className="flex-row justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={() => setIsEditing(false)}
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
  )
}
