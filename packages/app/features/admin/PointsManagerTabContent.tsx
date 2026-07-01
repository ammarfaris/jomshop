import { useState } from 'react'
import {
  View,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Label } from 'app/components/ui/label'
import { toast } from 'app/lib/sonner-universal'
import { useAuth } from 'app/contexts/AuthContext'
import { usePoints } from 'app/contexts/PointsContext'
import { adminAdjustPointsSupabase } from 'app/lib/supabase/points'

type Props = {
  containerMaxWidth: number
}

export default function PointsManagerTabContent({ containerMaxWidth }: Props) {
  const { user } = useAuth()
  const { refreshPoints } = usePoints()
  const colorScheme = useColorScheme()
  const [userId, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionMs, setDescriptionMs] = useState('')
  const [isAwarding, setIsAwarding] = useState(false)

  const handleAwardPoints = async () => {
    // Validation
    if (!userId.trim()) {
      toast.error('User ID is required')
      return
    }

    const pointsAmount = parseInt(amount)
    if (isNaN(pointsAmount) || pointsAmount === 0) {
      toast.error('Amount must be a non-zero number')
      return
    }

    if (Math.abs(pointsAmount) > 5000) {
      toast.error('Maximum 5,000 points per award')
      return
    }

    if (!description.trim()) {
      toast.error('Description is required')
      return
    }

    setIsAwarding(true)
    const loadingToastId = toast.loading('Awarding points...')

    try {
      await adminAdjustPointsSupabase(
        userId.trim(),
        pointsAmount,
        description.trim(),
        {
          adminUserId: user?.$id,
          awardedViaAdminPanel: true,
          description_ms: descriptionMs.trim() || null,
          timestamp: new Date().toISOString(),
        }
      )
      toast.dismiss(loadingToastId)
      toast.success(
        `Successfully ${pointsAmount > 0 ? 'awarded' : 'reduced'} ${Math.abs(
          pointsAmount
        )} points to user ${userId.substring(0, 8)}...`
      )
      setUserId('')
      setAmount('')
      setDescription('')
      setDescriptionMs('')
      if (userId.trim() === user?.$id) {
        refreshPoints()
      }
    } catch (error) {
      toast.dismiss(loadingToastId)
      toast.error(
        error instanceof Error ? error.message : 'Failed to award points'
      )
    } finally {
      setIsAwarding(false)
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
          <Text className="text-2xl font-bold">Award Points</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Manually award points to users. This creates a proper transaction
            record.
          </Text>
        </View>

        {/* Warning Box */}
        <View className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-2xl">⚠️</Text>
            <Text className="font-bold text-amber-900 dark:text-amber-100">
              Admin Only
            </Text>
          </View>
          <Text className="text-sm text-amber-900 dark:text-amber-100">
            This action requires admin privileges. Points are awarded through
            the secure server function with proper validation.
          </Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          {/* User ID */}
          <View className="gap-2">
            <Label nativeID="userId">User ID *</Label>
            <Input
              placeholder="Enter user ID (UUID, e.g., 00000000-0000-0000-0000-000000000000)"
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isAwarding}
            />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Get the user ID from the Supabase dashboard or user profile
            </Text>
          </View>

          {/* Amount */}
          <View className="gap-2">
            <Label nativeID="amount">Points Amount *</Label>
            <Input
              placeholder="Enter amount (e.g., 500 or -500)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numbers-and-punctuation"
              editable={!isAwarding}
            />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Maximum 5,000 points per award. Use negative values to reduce
              points.
            </Text>

            {/* Quick Actions */}
            <View className="flex-row flex-wrap gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAmount('100')}
                disabled={isAwarding}
              >
                <Text className="text-xs">+100</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAmount('500')}
                disabled={isAwarding}
              >
                <Text className="text-xs">+500</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAmount('1000')}
                disabled={isAwarding}
              >
                <Text className="text-xs">+1000</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAmount('-100')}
                disabled={isAwarding}
              >
                <Text className="text-xs">-100</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAmount('-500')}
                disabled={isAwarding}
              >
                <Text className="text-xs">-500</Text>
              </Button>
            </View>
          </View>

          {/* Description */}
          <View className="gap-2">
            <Label nativeID="description">
              Reason / Description * (English)
            </Label>
            <Input
              placeholder="e.g., Contest winner bonus, Beta tester reward, etc."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              editable={!isAwarding}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              This will be visible to the user in their transaction history
            </Text>
          </View>

          {/* Description Malay */}
          <View className="gap-2">
            <Label nativeID="descriptionMs">
              Reason / Description (Malay - Optional)
            </Label>
            <Input
              placeholder="e.g., Bonus pemenang pertandingan, Ganjaran penguji beta, dll."
              value={descriptionMs}
              onChangeText={setDescriptionMs}
              multiline
              numberOfLines={3}
              editable={!isAwarding}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Optional Malay translation. If left empty, English description
              will be used.
            </Text>
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleAwardPoints}
            disabled={isAwarding || !userId || !amount || !description}
            className="mt-2"
          >
            {isAwarding ? (
              <View className="flex-row items-center justify-center gap-2 w-full">
                <ActivityIndicator
                  color={colorScheme === 'dark' ? '#1f2937' : 'white'}
                  size="small"
                />
                <Text className="text-white font-semibold dark:text-gray-900">
                  Awarding Points...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-semibold dark:text-gray-900">
                Award Points
              </Text>
            )}
          </Button>
        </View>

        {/* Info Box */}
        <View className="border border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xl">ℹ️</Text>
            <Text className="font-bold text-blue-900 dark:text-blue-100">
              How it works
            </Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Creates a transaction in pointsTransactions collection
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Updates user's balance and lifetime_earned
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • User can see this in their transaction history
            </Text>
            <Text className="text-sm text-blue-900 dark:text-blue-100">
              • Source will be marked as "admin"
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
