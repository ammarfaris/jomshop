import { useState, useEffect } from 'react'
import {
  View,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Pressable,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Label } from 'app/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'app/components/ui/alert-dialog'
import { toast } from 'app/lib/sonner-universal'
import { useAuth } from 'app/contexts/AuthContext'
import {
  listSupabaseReferralSettings,
  upsertSupabaseReferralSetting,
  deleteSupabaseReferralSetting,
  getSupabaseCompletedReferralCount,
} from 'app/lib/supabase/referrals'

type Props = {
  containerMaxWidth: number
}

type ReferralSetting = {
  $id: string
  $createdAt: string
  $updatedAt: string
  user_id: string
  max_referrals: number
  notes?: string
  modified_by?: string
  previous_limit?: number
}

export default function ReferralManagerTabContent({
  containerMaxWidth,
}: Props) {
  const { user } = useAuth()
  const colorScheme = useColorScheme()

  // Form states
  const [userId, setUserId] = useState('')
  const [maxReferrals, setMaxReferrals] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // List states
  const [settings, setSettings] = useState<ReferralSetting[]>([])
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<{
    settingId: string
    userId: string
    currentCount: number
  } | null>(null)

  // Edit warning dialog state (when new limit < current referrals)
  const [editWarningOpen, setEditWarningOpen] = useState(false)
  const [editWarningData, setEditWarningData] = useState<{
    currentCount: number
    newLimit: number
    userId: string
  } | null>(null)

  // Load existing settings
  const loadSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const rows = await listSupabaseReferralSettings()
      setSettings(rows as unknown as ReferralSetting[])
      return
    } catch (error) {
      console.error('Failed to load referral settings:', error)
      toast.error('Failed to load referral settings')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // Get user's current referral count
  const getReferralCount = async (referrerUserId: string) => {
    try {
      return await getSupabaseCompletedReferralCount(referrerUserId)
    } catch (error) {
      console.error('Failed to get referral count:', error)
      return 0
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!userId.trim()) {
      toast.error('User ID is required')
      return
    }

    const limit = parseInt(maxReferrals)
    if (isNaN(limit) || limit < 0) {
      toast.error('Max referrals must be a positive number')
      return
    }

    if (limit > 1000) {
      toast.error('Maximum 1,000 referrals allowed')
      return
    }

    // Check if editing and new limit is lower than current referrals
    if (editingId) {
      const existingSetting = settings.find((s) => s.$id === editingId)
      if (existingSetting) {
        const currentCount = await getReferralCount(existingSetting.user_id)
        if (currentCount > limit) {
          // Store data and show warning dialog
          setEditWarningData({
            currentCount,
            newLimit: limit,
            userId: existingSetting.user_id,
          })
          setEditWarningOpen(true)
          return // Wait for user confirmation
        }
      }
    }

    // Proceed with submission
    await proceedWithSubmit(limit)
  }

  const proceedWithSubmit = async (limit: number) => {
    setIsSubmitting(true)
    const loadingToastId = toast.loading(
      editingId ? 'Updating referral limit...' : 'Setting referral limit...'
    )

    try {
      const existingSetting = editingId
        ? settings.find((s) => s.$id === editingId)
        : null
      await upsertSupabaseReferralSetting({
        userId: userId.trim(),
        maxReferrals: limit,
        notes: notes.trim() || null,
        modifiedBy: user?.$id,
        previousLimit: editingId ? existingSetting?.max_referrals ?? 10 : 10,
      })
      toast.dismiss(loadingToastId)
      toast.success(
        editingId
          ? `Updated referral limit for user ${userId.substring(0, 8)}...`
          : `Set referral limit for user ${userId.substring(0, 8)}...`
      )
      setUserId('')
      setMaxReferrals('')
      setNotes('')
      setEditingId(null)
      await loadSettings()
      return
    } catch (error: any) {
      toast.dismiss(loadingToastId)
      console.error('Submit error:', error)

      // Handle duplicate user_id error
      if (error.code === 409 || error.message?.includes('unique')) {
        toast.error(
          'This user already has a custom limit. Please edit the existing entry.'
        )
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to set referral limit'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditWarningConfirm = async () => {
    if (!editWarningData) return

    // Close dialog
    setEditWarningOpen(false)

    // Proceed with the submit using the stored limit
    await proceedWithSubmit(editWarningData.newLimit)

    // Clear warning data
    setEditWarningData(null)
  }

  const handleEdit = (setting: ReferralSetting) => {
    setUserId(setting.user_id)
    setMaxReferrals(setting.max_referrals.toString())
    setNotes(setting.notes || '')
    setEditingId(setting.$id)
    // Scroll to top on mobile
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCancelEdit = () => {
    setUserId('')
    setMaxReferrals('')
    setNotes('')
    setEditingId(null)
  }

  const handleDeleteClick = async (settingId: string, userId: string) => {
    // First check their current referral count
    const loadingToastId = toast.loading('Checking referral count...')
    try {
      const currentCount = await getReferralCount(userId)
      toast.dismiss(loadingToastId)

      // Store the info and open dialog
      setDeletingItem({ settingId, userId, currentCount })
      setDeleteDialogOpen(true)
    } catch (error) {
      toast.dismiss(loadingToastId)
      console.error('Error checking referral count:', error)
      toast.error('Failed to check referral count')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return

    const deletingToastId = toast.loading('Removing custom limit...')
    try {
      await deleteSupabaseReferralSetting(deletingItem.userId)

      toast.dismiss(deletingToastId)
      toast.success('Custom referral limit removed')

      // Close dialog and clear state
      setDeleteDialogOpen(false)
      setDeletingItem(null)

      // Reload settings
      await loadSettings()
    } catch (error) {
      toast.dismiss(deletingToastId)
      console.error('Delete error:', error)
      toast.error('Failed to remove custom limit')
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
          <Text className="text-2xl font-bold">Referral Limit Manager</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Set custom referral limits for specific users. Default limit is 10
            referrals per user.
          </Text>
        </View>

        {/* Info Box */}
        <View className="border border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xl">ℹ️</Text>
            <Text className="font-bold text-blue-900 dark:text-blue-100">
              How Referral Limits Work
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Default: All users can refer up to 10 friends
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Custom limits: Override the default for specific users
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Limit is enforced server-side when referee uploads first receipt
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Changes are logged with admin ID and timestamp
            </Text>
          </View>
        </View>

        {/* Form */}
        <View className="border border-border rounded-lg p-4 bg-white dark:bg-gray-900">
          <Text className="text-lg font-bold mb-4">
            {editingId ? 'Edit Custom Limit' : 'Add Custom Limit'}
          </Text>

          <View className="gap-4">
            {/* User ID */}
            <View className="gap-2">
              <Label nativeID="userId">User ID *</Label>
              <Input
                placeholder="Enter user ID (e.g., 6915515900296397d382)"
                value={userId}
                onChangeText={setUserId}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && !editingId}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {editingId
                  ? 'User ID cannot be changed when editing'
                  : 'Get the user ID from Supabase dashboard'}
              </Text>
            </View>

            {/* Max Referrals */}
            <View className="gap-2">
              <Label nativeID="maxReferrals">Max Referrals *</Label>
              <Input
                placeholder="Enter max referrals (e.g., 50)"
                value={maxReferrals}
                onChangeText={setMaxReferrals}
                keyboardType="number-pad"
                editable={!isSubmitting}
              />

              {/* Quick Actions */}
              <View className="flex-row flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setMaxReferrals('20')}
                  disabled={isSubmitting}
                >
                  <Text className="text-xs">20</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setMaxReferrals('50')}
                  disabled={isSubmitting}
                >
                  <Text className="text-xs">50</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setMaxReferrals('100')}
                  disabled={isSubmitting}
                >
                  <Text className="text-xs">100</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setMaxReferrals('0')}
                  disabled={isSubmitting}
                >
                  <Text className="text-xs">Disable (0)</Text>
                </Button>
              </View>
            </View>

            {/* Notes */}
            <View className="gap-2">
              <Label nativeID="notes">Admin Notes (Optional)</Label>
              <Input
                placeholder="e.g., VIP user, Special promotion, Brand partnership, etc."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Internal notes for admin reference only (not visible to users)
              </Text>
            </View>

            {/* Submit Buttons */}
            <View className="flex-row gap-2">
              {editingId && (
                <Button
                  variant="outline"
                  onPress={handleCancelEdit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  <Text className="font-semibold">Cancel</Text>
                </Button>
              )}
              <Button
                onPress={handleSubmit}
                disabled={isSubmitting || !userId || !maxReferrals}
                className="flex-1"
              >
                {isSubmitting ? (
                  <View className="flex-row items-center justify-center gap-2 w-full">
                    <ActivityIndicator
                      color={colorScheme === 'dark' ? '#1f2937' : 'white'}
                      size="small"
                    />
                    <Text className="text-white font-semibold dark:text-gray-900">
                      {editingId ? 'Updating...' : 'Saving...'}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-white font-semibold dark:text-gray-900">
                    {editingId ? 'Update Limit' : 'Set Custom Limit'}
                  </Text>
                )}
              </Button>
            </View>
          </View>
        </View>

        {/* Existing Settings List */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold">Custom Limits</Text>
            <Button
              variant="outline"
              size="sm"
              onPress={loadSettings}
              disabled={isLoadingSettings}
            >
              {isLoadingSettings ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-xs">Refresh</Text>
              )}
            </Button>
          </View>

          {isLoadingSettings ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" />
            </View>
          ) : settings.length === 0 ? (
            <View className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 items-center">
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                No custom referral limits set yet.{'\n'}Add one above to get
                started.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {settings.map((setting) => (
                <SettingCard
                  key={setting.$id}
                  setting={setting}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  isEditing={editingId === setting.$id}
                  getReferralCount={getReferralCount}
                />
              ))}
            </View>
          )}
        </View>

        {/* Warning Box */}
        <View className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="font-bold text-amber-900 dark:text-amber-100">
              Important Notes
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              • Limits are enforced server-side and cannot be bypassed by users
            </Text>
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              • Referee still gets their 200 points even if referrer hit limit
            </Text>
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              • Setting limit to 0 disables referrals for that user
            </Text>
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              • All changes are logged with your admin ID and timestamp
            </Text>
          </View>
        </View>
      </View>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingItem && deletingItem.currentCount > 10
                ? '⚠️ Warning: High Referral Count'
                : 'Confirm Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem && deletingItem.currentCount > 10 ? (
                <Text className="text-sm text-muted-foreground">
                  This user has {deletingItem.currentCount} completed referrals!
                  {'\n\n'}
                  If you remove their custom limit, they will revert to the
                  default limit of 10.{'\n\n'}
                  This means:{'\n'}• Their profile will show "
                  {deletingItem.currentCount}/10" (exceeded){'\n'}• They cannot
                  receive credit for any new referrals{'\n'}• Their existing{' '}
                  {deletingItem.currentCount} completed referrals will remain
                  {'\n\n'}
                  Consider setting a higher limit instead of deleting.
                </Text>
              ) : (
                <Text className="text-sm text-muted-foreground">
                  {deletingItem &&
                    `Are you sure you want to remove the custom referral limit for user ${deletingItem.userId.substring(
                      0,
                      8
                    )}...?\n\nCurrent referrals: ${
                      deletingItem.currentCount
                    }\n\nThey will revert to the default limit of 10 referrals.`}
                </Text>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm}>
              <Text>Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Warning Dialog (when new limit < current referrals) */}
      <AlertDialog open={editWarningOpen} onOpenChange={setEditWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ⚠️ Warning: Limit Below Current Referrals
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editWarningData && (
                <Text className="text-sm text-muted-foreground">
                  This user has {editWarningData.currentCount} completed
                  referrals!{'\n\n'}
                  You are setting the limit to {editWarningData.newLimit}.
                  {'\n\n'}
                  This means:{'\n'}• Their profile will show "
                  {editWarningData.currentCount}/{editWarningData.newLimit}"
                  (exceeded){'\n'}• They cannot receive credit for any new
                  referrals{'\n'}• Their existing {editWarningData.currentCount}{' '}
                  completed referrals will remain{'\n\n'}
                  Do you want to proceed?
                </Text>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleEditWarningConfirm}>
              <Text>Update Limit</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  )
}

// Setting Card Component
function SettingCard({
  setting,
  onEdit,
  onDelete,
  isEditing,
  getReferralCount,
}: {
  setting: ReferralSetting
  onEdit: (setting: ReferralSetting) => void
  onDelete: (id: string, userId: string) => void
  isEditing: boolean
  getReferralCount: (userId: string) => Promise<number>
}) {
  const [referralCount, setReferralCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  const loadCount = async () => {
    setLoadingCount(true)
    const count = await getReferralCount(setting.user_id)
    setReferralCount(count)
    setLoadingCount(false)
  }

  useEffect(() => {
    loadCount()
  }, [setting.user_id])

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <View
      className={`border rounded-lg p-4 ${
        isEditing
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-border bg-white dark:bg-gray-900'
      }`}
    >
      {/* User ID and Actions */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            User ID
          </Text>
          <Text
            className="font-mono text-sm font-semibold break-all"
            selectable
          >
            {setting.user_id}
          </Text>
        </View>
        <View className="flex-row gap-2 ml-2">
          <Pressable
            onPress={() => onEdit(setting)}
            className="bg-blue-500 px-3 py-1.5 rounded"
          >
            <Text className="text-white text-xs font-semibold">Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => onDelete(setting.$id, setting.user_id)}
            className="bg-red-500 px-3 py-1.5 rounded"
          >
            <Text className="text-white text-xs font-semibold">Delete</Text>
          </Pressable>
        </View>
      </View>

      {/* Max Referrals and Current Count */}
      <View className="flex-row gap-4 mb-3">
        <View className="flex-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Max Referrals
          </Text>
          <Text className="text-lg font-bold text-green-600 dark:text-green-400">
            {setting.max_referrals === 0 ? 'Disabled' : setting.max_referrals}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Current Referrals
          </Text>
          {loadingCount ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text
              className={`text-lg font-bold ${
                referralCount !== null &&
                setting.max_referrals > 0 &&
                referralCount >= setting.max_referrals
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              {referralCount ?? '...'} / {setting.max_referrals}
            </Text>
          )}
        </View>
      </View>

      {/* Notes */}
      {setting.notes && (
        <View className="mb-3">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Admin Notes
          </Text>
          <Text className="text-sm">{setting.notes}</Text>
        </View>
      )}

      {/* Audit Info */}
      <View className="border-t border-gray-200 dark:border-gray-700 pt-3 gap-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          Created: {formatDate(setting.$createdAt)}
        </Text>
        {setting.$updatedAt !== setting.$createdAt && (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Updated: {formatDate(setting.$updatedAt)}
            {setting.modified_by &&
              ` by ${setting.modified_by.substring(0, 8)}...`}
          </Text>
        )}
        {setting.previous_limit !== undefined && (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Previous Limit: {setting.previous_limit}
          </Text>
        )}
      </View>
    </View>
  )
}
