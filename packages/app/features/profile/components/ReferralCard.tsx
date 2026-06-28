'use client'

import { useState, useEffect } from 'react'
import {
  View,
  Pressable,
  Share,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { useAuth } from 'app/contexts/AuthContext'
import { usePoints } from 'app/contexts/PointsContext'
import { cn } from 'app/lib/utils'
import { Trans } from '@lingui/react/macro'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { copyToClipboard } from 'app/lib/clipboard'
import { functions, tablesDB } from 'app/provider/appwrite/api'
import { ExecutionMethod, Query } from 'app/lib/appwrite-universal'
import {
  DATABASE_ID,
  USER_REFERRALS_COLLECTION_ID,
  REFERRAL_SETTINGS_COLLECTION_ID,
} from 'app/provider/appwrite/constants'
import { toast } from 'app/lib/sonner-universal'

const REDEEM_REFERRAL_CODE_FUNCTION_ID = 'fn_redeem-referral-code'

interface ReferralCardProps {
  /** Additional className */
  className?: string
}

interface ReferralRecord {
  $id: string
  $createdAt: string
  referrer_user_id: string
  referee_user_id: string
  referral_code: string
  status: 'pending' | 'completed' | 'limit_reached'
  points_awarded: number
  completed_at?: string
  referee_fullname?: string
  referee_email?: string
  referrer_fullname?: string
  referrer_email?: string
}

// Generate referral code from user ID (full ID)
function generateReferralCode(userId: string): string {
  return userId
}

// Generate referral link
function getReferralLink(referralCode: string): string {
  // Production: use jomcontest.com
  return `https://www.jomcontest.com/sign-in-register?redirect=/profile&ref=${referralCode}`

  // Development: use localhost
  // return `http://localhost:19000/sign-in-register?redirect=/profile&ref=${referralCode}`
}

// Get status display info
function getStatusInfo(status: string): {
  emoji: string
  label: string
  color: string
} {
  switch (status) {
    case 'completed':
      return {
        emoji: '✅',
        label: 'Completed',
        color: 'text-green-600 dark:text-green-400',
      }
    case 'pending':
      return {
        emoji: '⏳',
        label: 'Pending',
        color: 'text-amber-600 dark:text-amber-400',
      }
    case 'limit_reached':
      return {
        emoji: '🚫',
        label: 'Limit Reached',
        color: 'text-red-600 dark:text-red-400',
      }
    default:
      return { emoji: '❓', label: status, color: 'text-gray-500' }
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

export function ReferralCard({ className }: ReferralCardProps) {
  const { user } = useAuth()
  const { completedReferrals, refreshPoints } = usePoints()
  const { isDarkColorScheme } = useColorScheme()
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // State for redeeming a referral code
  const [inputCode, setInputCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [hasReferrer, setHasReferrer] = useState(false) // Default false to show input section
  const [checkingReferrer, setCheckingReferrer] = useState(true)

  // State for referral history
  const [referralHistory, setReferralHistory] = useState<ReferralRecord[]>([])
  const [myReferralRecord, setMyReferralRecord] =
    useState<ReferralRecord | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // State for hiding referral input (account age, has receipts)
  const [hasUploadedReceipts, setHasUploadedReceipts] = useState(false)
  const [isAccountTooOld, setIsAccountTooOld] = useState(false)

  // State for custom referral limit
  const [maxReferrals, setMaxReferrals] = useState(10) // Default 10, fetched from server
  const [additionalReferralsNote, setAdditionalReferralsNote] = useState<
    string | null
  >(null)

  // Check for referral code in URL on web and auto-fill input
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const refCode = params.get('ref')
      if (refCode && refCode.length >= 15) {
        setInputCode(refCode)
        // Clean up the URL by removing the ref parameter
        const url = new URL(window.location.href)
        url.searchParams.delete('ref')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [])

  // Fetch custom referral limit from referralSettings
  useEffect(() => {
    async function fetchMaxReferrals() {
      if (!user) return
      try {
        const response = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: REFERRAL_SETTINGS_COLLECTION_ID,
          queries: [Query.equal('user_id', user.$id), Query.limit(1)],
        })
        if (response.total > 0 && response.rows[0]) {
          const row = response.rows[0] as {
            max_referrals?: number
            notes?: string
          }
          const customLimit = row.max_referrals
          if (typeof customLimit === 'number') {
            setMaxReferrals(customLimit)
          }
          // Store note if it exists
          if (row.notes && typeof row.notes === 'string') {
            setAdditionalReferralsNote(row.notes)
          }
        }
      } catch (error) {
        // If error (e.g., permission denied), use default of 10
        console.log('[ReferralCard] Using default max referrals (10)')
      }
    }
    fetchMaxReferrals()
  }, [user])

  // Fetch referral history (people this user has referred + when this user was referred)
  useEffect(() => {
    async function fetchReferralHistory() {
      if (!user) {
        setLoadingHistory(false)
        return
      }
      try {
        // console.log(
        //   '[ReferralCard] Fetching referral history for user:',
        //   user.$id
        // )
        // Fetch referrals made by this user
        const response = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_REFERRALS_COLLECTION_ID,
          queries: [
            Query.equal('referrer_user_id', user.$id),
            Query.orderDesc('$createdAt'),
            Query.limit(50),
          ],
        })
        // console.log(
        //   '[ReferralCard] Referral history:',
        //   response.total,
        //   'records'
        // )
        setReferralHistory(response.rows as unknown as ReferralRecord[])

        // Also fetch if this user was referred by someone else
        const myReferralResponse = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_REFERRALS_COLLECTION_ID,
          queries: [Query.equal('referee_user_id', user.$id), Query.limit(1)],
        })
        if (myReferralResponse.total > 0) {
          setMyReferralRecord(
            myReferralResponse.rows[0] as unknown as ReferralRecord
          )
        } else {
          setMyReferralRecord(null)
        }
      } catch (error) {
        // console.error('[ReferralCard] Error fetching referral history:', error)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchReferralHistory()
  }, [user])

  // Check if account is older than 1 month or user has uploaded receipts
  useEffect(() => {
    if (!user) return

    // Check account age (1 month = 30 days)
    const accountCreatedAt = new Date(user.$createdAt)
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    if (accountCreatedAt < oneMonthAgo) {
      setIsAccountTooOld(true)
    }

    // Check if user has uploaded any receipts
    async function checkUserReceipts() {
      if (!user) return
      try {
        const response = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: 'usersReceipts',
          queries: [Query.equal('user_id', user.$id), Query.limit(1)],
        })
        if (response.total > 0) {
          setHasUploadedReceipts(true)
        }
      } catch (error) {
        // console.error('[ReferralCard] Error checking user receipts:', error)
      }
    }
    checkUserReceipts()
  }, [user])

  // Check if this user has already been referred by someone
  useEffect(() => {
    async function checkIfReferred() {
      if (!user) {
        setCheckingReferrer(false)
        return
      }
      try {
        // console.log(
        //   '[ReferralCard] Checking referral status for user:',
        //   user.$id
        // )
        const response = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: USER_REFERRALS_COLLECTION_ID,
          queries: [Query.equal('referee_user_id', user.$id), Query.limit(1)],
        })
        // console.log(
        //   '[ReferralCard] Referral check result:',
        //   response.total > 0 ? 'Has referrer' : 'No referrer',
        //   'Total:',
        //   response.total
        // )
        setHasReferrer(response.total > 0)
      } catch (error) {
        // console.error('[ReferralCard] Error checking referral status:', error)
        // On error, show the input anyway so users can try to redeem
        setHasReferrer(false)
      } finally {
        setCheckingReferrer(false)
      }
    }
    checkIfReferred()
  }, [user])

  // Don't show if user is not logged in
  if (!user) return null

  const referralCode = generateReferralCode(user.$id)
  const referralLink = getReferralLink(referralCode)

  const handleCopyCode = async () => {
    try {
      const success = await copyToClipboard(referralCode)
      if (success) {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleCopyLink = async () => {
    try {
      const success = await copyToClipboard(referralLink)
      if (success) {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const shareMessage = `🎉 Join me on JomContest and get 200 Bonus Points!

✨ Why JomContest?
"Contest discovery made easy, Winning made possible!"

🔗 Sign up here:
${referralLink}

💡 OR enter my referral code after signing up:
${referralCode}

👥 We both get 200 points when you upload your first receipt!`

      await Share.share({
        message: shareMessage,
        url: Platform.OS === 'ios' ? referralLink : undefined,
        title: 'JomContest!',
      })
    } catch (error) {
      console.error('Share failed:', error)
    } finally {
      setIsSharing(false)
    }
  }

  const progress = Math.min(completedReferrals / maxReferrals, 1)
  const remainingReferrals = Math.max(maxReferrals - completedReferrals, 0)

  const handleRedeemCode = async () => {
    const code = inputCode.trim()
    if (!code || code.length < 15) {
      toast.error('Please enter a valid referral code.')
      return
    }

    // Prevent self-referral (client-side check, server also validates)
    if (code === referralCode) {
      toast.error("You can't use your own referral code.")
      return
    }

    setIsRedeeming(true)
    try {
      const execution = await functions.createExecution(
        REDEEM_REFERRAL_CODE_FUNCTION_ID,
        JSON.stringify({ code }),
        false,
        '/',
        ExecutionMethod.POST
      )

      const responseBody = execution.responseBody || (execution as any).response

      if (!responseBody) {
        throw new Error('Empty response from server')
      }

      const data = JSON.parse(responseBody)

      if (!data.success) {
        throw new Error(data.error || 'Failed to redeem code')
      }

      toast.success(
        'Referral code redeemed! You and your friend will each get 200 points after you upload your first receipt.'
      )
      setHasReferrer(true)
      setInputCode('')
      // Refresh points to update the balance
      refreshPoints()
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code. Please try again.')
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <View
      className={cn(
        'rounded-2xl p-4',
        isDarkColorScheme ? 'bg-gray-800' : 'bg-gray-50',
        className
      )}
    >
      {/* Enter Referral Code Section - hide if: already has referrer, account > 1 month, or has uploaded receipts */}
      {!checkingReferrer &&
        !hasReferrer &&
        !isAccountTooOld &&
        !hasUploadedReceipts && (
          <View className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-bold mb-1">
              <Trans>Have a referral code? Earn 200 points!</Trans>
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              <Trans>
                Enter a friend's code who referred you. You can only do this
                once.
              </Trans>
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={inputCode}
                onChangeText={(text) => setInputCode(text.trim())}
                placeholder="Enter friend's referral code"
                placeholderTextColor={isDarkColorScheme ? '#6b7280' : '#9ca3af'}
                autoCapitalize="none"
                editable={!isRedeeming}
                className={cn(
                  'flex-1 rounded-xl px-4 py-3 font-mono text-base tracking-widest',
                  isDarkColorScheme
                    ? 'bg-gray-900 text-white border border-gray-600'
                    : 'bg-white text-black border border-gray-200'
                )}
              />
              <Pressable
                onPress={handleRedeemCode}
                disabled={isRedeeming || inputCode.length < 15}
                className={cn(
                  'rounded-xl px-5 items-center justify-center',
                  inputCode.length < 15
                    ? 'bg-gray-300 dark:bg-gray-600'
                    : 'bg-main'
                )}
              >
                {isRedeeming ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold">
                    <Trans>Redeem</Trans>
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

      {/* Pending Referral Indicator - shown when user has redeemed a code but hasn't uploaded first receipt */}
      {hasReferrer && !hasUploadedReceipts && (
        <View className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-sm">⏳</Text>
              <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                <Trans>Referral Pending</Trans>
              </Text>
            </View>
            <Text className="text-xs text-amber-600 dark:text-amber-300">
              <Trans>
                Upload your first receipt to complete the referral and earn 200
                bonus points!
              </Trans>
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-2xl">👥</Text>
        <View>
          <Text className="text-lg font-bold">
            <Trans>Refer Friends</Trans>
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            <Trans>Earn 200 points per referral</Trans>
          </Text>
        </View>
      </View>

      {/* Referral Code Display */}
      <View className="bg-white dark:bg-gray-700 rounded-xl p-3 mb-3">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Trans>Your Referral Code</Trans>
        </Text>
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text
            className="text-base font-bold font-mono tracking-wide color-main flex-shrink"
            selectable
          >
            {referralCode}
          </Text>
          <Pressable
            onPress={handleCopyCode}
            className={cn(
              'px-3 py-1 rounded-lg',
              copiedCode ? 'bg-green-500' : 'bg-main/10'
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                copiedCode ? 'text-white' : 'color-main'
              )}
            >
              {copiedCode ? '✓ Copied' : '📋 Copy'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-2 mb-3">
        {/* Copy Link Button */}
        <Pressable
          onPress={handleCopyLink}
          className={cn(
            'flex-1 rounded-xl py-3 items-center',
            copiedLink ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
          )}
        >
          <Text
            className={cn(
              'font-medium',
              copiedLink ? 'text-white' : 'text-gray-700 dark:text-gray-200'
            )}
          >
            {copiedLink ? '✓ Copied' : '🔗 Copy Link'}
          </Text>
        </Pressable>

        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          disabled={isSharing}
          className="flex-1 bg-main rounded-xl py-3 items-center"
        >
          {isSharing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="font-medium text-white">
              📤 <Trans>Share Invite</Trans>
            </Text>
          )}
        </Pressable>
      </View>

      {/* How it works */}
      <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          <Trans>How it works</Trans>
        </Text>
        <View className="gap-1">
          <Text className="text-xs text-gray-500 dark:text-gray-500">
            1️⃣ <Trans>Share your code with friends</Trans>
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-500">
            2️⃣ <Trans>They sign up & upload their first receipt</Trans>
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-500">
            3️⃣{' '}
            <Trans>
              For each successful referral, you and your friend will both
              receive 200 points!
            </Trans>
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            <Trans>Referral Progress</Trans>
          </Text>
          <Text className="text-sm font-medium">
            {completedReferrals}/{maxReferrals}
          </Text>
        </View>
        <View className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <View
            className="h-full bg-main rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        {remainingReferrals > 0 ? (
          <>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <Trans>
                {remainingReferrals} referrals remaining • Earn up to{' '}
                {remainingReferrals * 200} more points!
              </Trans>
            </Text>
            {additionalReferralsNote && (
              <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                Note: {additionalReferralsNote}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              🎉 <Trans>You've reached the maximum referrals!</Trans>
            </Text>
            {additionalReferralsNote && (
              <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                Note: {additionalReferralsNote}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Referral History Section */}
      <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Pressable
          onPress={() => setShowHistory(!showHistory)}
          className="flex-row justify-between items-center"
        >
          <Text className="text-sm font-bold">
            <Trans>Referral History</Trans>
          </Text>
          <View className="flex-row items-center gap-2">
            {!loadingHistory &&
              (referralHistory.length > 0 || myReferralRecord) && (
                <View className="bg-main/10 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-medium color-main">
                    {referralHistory.length + (myReferralRecord ? 1 : 0)}
                  </Text>
                </View>
              )}
            <Text className="text-gray-500">{showHistory ? '▲' : '▼'}</Text>
          </View>
        </Pressable>

        {showHistory && (
          <View className="mt-3">
            {loadingHistory ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" />
              </View>
            ) : referralHistory.length === 0 && !myReferralRecord ? (
              <View className="py-4 items-center">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  <Trans>
                    No referrals yet. Share your code to get started!
                  </Trans>
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {/* Show user's own referral first if it exists */}
                {myReferralRecord && (
                  <View
                    className={cn(
                      'rounded-xl p-3',
                      myReferralRecord.status === 'pending'
                        ? 'border-2 border-amber-500/30'
                        : '',
                      isDarkColorScheme ? 'bg-gray-700' : 'bg-white'
                    )}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm">
                            {myReferralRecord.status === 'completed'
                              ? '✅'
                              : '🎁'}
                          </Text>
                          <Text
                            className={cn(
                              'text-xs font-medium',
                              myReferralRecord.status === 'completed'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                            )}
                          >
                            <Trans>You Were Referred By:</Trans>
                          </Text>
                        </View>
                        <Text
                          className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                          numberOfLines={1}
                        >
                          {myReferralRecord.referrer_fullname &&
                          myReferralRecord.referrer_email
                            ? `${myReferralRecord.referrer_fullname} (${myReferralRecord.referrer_email})`
                            : myReferralRecord.referrer_fullname ||
                              myReferralRecord.referrer_email ||
                              myReferralRecord.referrer_user_id.slice(0, 12) +
                                '...'}
                        </Text>
                        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {formatDate(myReferralRecord.$createdAt)}
                        </Text>
                      </View>
                      {myReferralRecord.status === 'completed' &&
                        myReferralRecord.points_awarded > 0 && (
                          <View className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg">
                            <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                              +{myReferralRecord.points_awarded} pts
                            </Text>
                          </View>
                        )}
                      {myReferralRecord.status === 'pending' && (
                        <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                          <Text className="text-xs text-amber-700 dark:text-amber-400">
                            <Trans>Action Required</Trans>
                          </Text>
                        </View>
                      )}
                    </View>
                    {myReferralRecord.status === 'pending' && (
                      <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">
                        <Trans>
                          Upload your first receipt to earn 200 points and
                          complete this referral
                        </Trans>
                      </Text>
                    )}
                  </View>
                )}
                {referralHistory.map((referral) => {
                  const statusInfo = getStatusInfo(referral.status)
                  return (
                    <View
                      key={referral.$id}
                      className={cn(
                        'rounded-xl p-3',
                        isDarkColorScheme ? 'bg-gray-700' : 'bg-white'
                      )}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm">{statusInfo.emoji}</Text>
                            <Text
                              className={cn(
                                'text-xs font-medium',
                                statusInfo.color
                              )}
                            >
                              <Trans>Your Referral:</Trans>
                            </Text>
                          </View>
                          <Text
                            className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                            numberOfLines={1}
                          >
                            {referral.referee_fullname && referral.referee_email
                              ? `${referral.referee_fullname} (${referral.referee_email})`
                              : referral.referee_fullname ||
                                referral.referee_email ||
                                referral.referee_user_id.slice(0, 12) + '...'}
                          </Text>
                          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {formatDate(referral.$createdAt)}
                          </Text>
                        </View>
                        {referral.status === 'completed' &&
                          referral.points_awarded > 0 && (
                            <View className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg">
                              <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                                +{referral.points_awarded} pts
                              </Text>
                            </View>
                          )}
                        {referral.status === 'pending' && (
                          <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                            <Text className="text-xs text-amber-700 dark:text-amber-400">
                              <Trans>Waiting</Trans>
                            </Text>
                          </View>
                        )}
                      </View>
                      {referral.status === 'pending' && (
                        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">
                          <Trans>
                            Waiting for friend to upload their first receipt
                            (both get 200 points!)
                          </Trans>
                        </Text>
                      )}
                      {referral.status === 'limit_reached' && (
                        <Text className="text-xs text-red-500 dark:text-red-400 mt-2">
                          <Trans>
                            You had reached your referral limit when this was
                            processed
                          </Trans>
                        </Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
