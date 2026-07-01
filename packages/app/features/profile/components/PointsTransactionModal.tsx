'use client'

import { useState, useEffect } from 'react'
import {
  View,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { useAuth } from 'app/contexts/AuthContext'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { cn } from 'app/lib/utils'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react/macro'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import { getSupabasePoints } from 'app/lib/supabase/points'

interface PointsTransactionModalProps {
  visible: boolean
  onClose: () => void
}

interface PointsTransaction {
  $id: string
  $createdAt: string
  user_id: string
  amount: number
  type: 'earn' | 'spend'
  source: string
  description: string
  description_ms?: string
  metadata?: string
}

// Get source display info
function getSourceInfo(source: string): {
  emoji: string
  label: string
  color: string
} {
  switch (source) {
    case 'referral':
      return {
        emoji: '👥',
        label: 'Referral Bonus',
        color: 'text-purple-600 dark:text-purple-400',
      }
    case 'signup':
      return {
        emoji: '🎉',
        label: 'Sign Up Bonus',
        color: 'text-blue-600 dark:text-blue-400',
      }
    case 'receipt':
      return {
        emoji: '🧾',
        label: 'Receipt Upload',
        color: 'text-green-600 dark:text-green-400',
      }
    case 'redemption':
      return {
        emoji: '🎁',
        label: 'Subscription Redemption',
        color: 'text-amber-600 dark:text-amber-400',
      }
    case 'bonus':
      return {
        emoji: '⭐',
        label: 'Bonus',
        color: 'text-yellow-600 dark:text-yellow-400',
      }
    case 'admin':
      return {
        emoji: '🔧',
        label: 'Admin Grant',
        color: 'text-gray-600 dark:text-gray-400',
      }
    case 'affiliate':
      return {
        emoji: '🤝',
        label: 'Affiliate',
        color: 'text-indigo-600 dark:text-indigo-400',
      }
    default:
      return {
        emoji: '💰',
        label: source,
        color: 'text-gray-600 dark:text-gray-400',
      }
  }
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format time for display (always 12-hour format with uppercase AM/PM)
function formatTime(dateString: string): string {
  const date = new Date(dateString)
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`
}

export function PointsTransactionModal({
  visible,
  onClose,
}: PointsTransactionModalProps) {
  const { user } = useAuth()
  const { isDarkColorScheme } = useColorScheme()
  const { i18n } = useLingui()
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lock body scroll on web when modal is visible (especially for iOS Safari)
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY

      // Prevent scrolling with iOS Safari fix
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      // Restore original styles when modal closes
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        window.scrollTo(0, scrollY)
      }
    }
  }, [visible])

  // Fetch transactions when modal opens
  useEffect(() => {
    async function fetchTransactions() {
      if (!user || !visible) return

      setIsLoading(true)
      setError(null)

      try {
        // console.log(
        //   '[PointsTransactionModal] Fetching transactions for user:',
        //   user.$id
        // )
        const points = await getSupabasePoints(100, 0)
        const rows: PointsTransaction[] = (points?.transactions ?? []).map(
          (tx) => ({
            $id: tx.id,
            $createdAt: tx.createdAt,
            user_id: user.$id,
            amount: tx.amount,
            type: tx.type,
            source: tx.source,
            description: tx.description,
          })
        )
        setTransactions(rows)
      } catch (err: any) {
        console.error(
          '[PointsTransactionModal] Error fetching transactions:',
          err
        )
        setError(err.message || 'Failed to load transactions')
      } finally {
        setIsLoading(false)
      }
    }

    if (visible) {
      fetchTransactions()
    }
  }, [user, visible])

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = formatDate(transaction.$createdAt)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(transaction)
    return groups
  }, {} as Record<string, PointsTransaction[]>)

  const renderTransaction = (transaction: PointsTransaction) => {
    const sourceInfo = getSourceInfo(transaction.source)
    const isEarn = transaction.type === 'earn'

    // Use Malay description if available and user locale is Malay, otherwise use English
    const isMalayLocale = i18n.locale === 'ms' || i18n.locale === 'ms-MY'
    const displayDescription =
      isMalayLocale && transaction.description_ms
        ? transaction.description_ms
        : transaction.description || sourceInfo.label

    return (
      <View
        key={transaction.$id}
        className={cn(
          'flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800'
        )}
      >
        <View className="flex-row items-center gap-3 flex-1">
          <View
            className={cn(
              'w-10 h-10 rounded-full items-center justify-center',
              isEarn
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            )}
          >
            <Text className="text-lg">{sourceInfo.emoji}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium" numberOfLines={2}>
              {displayDescription}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(transaction.$createdAt)}
            </Text>
          </View>
        </View>
        <View
          className={cn(
            'px-3 py-1 rounded-lg',
            isEarn
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          )}
        >
          <Text
            className={cn(
              'text-sm font-bold',
              isEarn
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            )}
          >
            {isEarn ? '+' : ''}
            {transaction.amount}
          </Text>
        </View>
      </View>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" />
          <Text className="text-gray-500 dark:text-gray-400 mt-3">
            <Trans>Loading transactions...</Trans>
          </Text>
        </View>
      )
    }

    if (error) {
      return (
        <View className="py-12 items-center">
          <Text className="text-4xl mb-3">❌</Text>
          <Text className="text-red-500 dark:text-red-400 text-center">
            {error}
          </Text>
        </View>
      )
    }

    if (transactions.length === 0) {
      return (
        <View className="py-12 items-center">
          <Text className="text-4xl mb-3">📭</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center">
            <Trans>No transactions yet</Trans>
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
            <Trans>
              Earn points by referring friends, more ways to earn points coming
              later!
            </Trans>
          </Text>
        </View>
      )
    }

    return (
      <View>
        {Object.entries(groupedTransactions).map(([date, txns]) => (
          <View key={date} className="mb-4">
            <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              {date}
            </Text>
            <View
              className={cn(
                'rounded-xl overflow-hidden',
                isDarkColorScheme ? 'bg-gray-800' : 'bg-gray-50'
              )}
            >
              <View className="px-3">
                {txns.map((txn) => renderTransaction(txn))}
              </View>
            </View>
          </View>
        ))}
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        {/* Backdrop - tap to close */}
        <Pressable className="absolute inset-0" onPress={onClose} />
        {/* Modal Content Container */}
        <View
          className={cn(
            'w-full max-w-md rounded-2xl overflow-hidden',
            isDarkColorScheme ? 'bg-gray-900' : 'bg-white'
          )}
          style={{
            maxHeight: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          {/* Header */}
          <View
            className={cn(
              'flex-row justify-between items-center p-4 border-b',
              isDarkColorScheme ? 'border-gray-800' : 'border-gray-100'
            )}
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-xl">🪙</Text>
              <Text className="text-lg font-bold">
                <Trans>Points History</Trans>
              </Text>
            </View>
            <Pressable onPress={onClose} className="p-2 -mr-2">
              <XMarkOutline width={24} height={24} className="text-gray-500" />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            className="p-4"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {renderContent()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
