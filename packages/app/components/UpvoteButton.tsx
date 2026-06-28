import { useEffect, useState } from 'react'
import { Pressable, ActivityIndicator, Platform } from 'react-native'
import { useLingui, Trans } from '@lingui/react/macro'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { useAuth } from 'app/contexts/AuthContext'
import { useRouter } from 'app/lib/router-universal'
import {
  useUpvoteStatus,
  useUpvoteCount,
  useUpvoteActions,
} from 'app/hooks/useUpvote'
import { formatUpvoteCount } from 'app/utils/formatters'
import { Text } from 'app/components/ui/text'
import { ArrowUpCircleOutline } from 'app/components/icons-svg/ArrowUpCircleOutline'
import { ArrowUpCircleSolid } from 'app/components/icons-svg/ArrowUpCircleSolid'
import { cn } from 'app/lib/utils'
import { toast } from 'app/lib/sonner-universal'
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

export interface UpvoteButtonProps {
  contestId: string
  variant?: 'default' | 'compact' | 'large'
  showCount?: boolean
  className?: string
  initialCount?: number // For anonymous users, pass count from public-contests function
}

export function UpvoteButton({
  contestId,
  variant = 'default',
  showCount = true,
  className,
  initialCount,
}: UpvoteButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)

  const { t } = useLingui()

  // Sign-in prompt dialog state for anonymous users
  const [signInDialogOpen, setSignInDialogOpen] = useState(false)

  // Hooks for data and actions - only fetch if user is logged in
  const { data: isUpvoted, isLoading: isStatusLoading } =
    useUpvoteStatus(contestId)
  const { data: upvoteCount, isLoading: isCountLoading } =
    useUpvoteCount(contestId)
  const {
    upvote,
    removeUpvote,
    isLoading: isActionLoading,
    error,
  } = useUpvoteActions(contestId)

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error(getErrorMessage(error))
    }
  }, [error])

  // Use upvoteCount from query if available, fallback to initialCount for anonymous users
  const displayCount = upvoteCount ?? initialCount ?? 0

  // Determine if button is in loading state
  // For anonymous users, don't show loading state for count since we have initialCount
  const isLoading = user
    ? isStatusLoading || isCountLoading || isActionLoading
    : false

  // Handle button click
  const handlePress = () => {
    // Check authentication - show dialog for anonymous users
    if (!user) {
      setSignInDialogOpen(true)
      return
    }

    // Toggle upvote based on current state
    if (isUpvoted) {
      removeUpvote()
    } else {
      upvote()
    }
  }

  // Handle sign-in from dialog
  const handleSignIn = () => {
    setSignInDialogOpen(false)
    // Get current path for redirect after sign-in
    const currentPath =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/' // Fallback for native
    router.push(`/sign-in-register?redirect=${encodeURIComponent(currentPath)}`)
  }

  // Variant-specific styles
  const buttonStyles = getButtonStyles(variant)
  const iconSize = getIconSize(variant)
  const textSize = getTextSize(variant)

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        className={cn(
          'flex-row items-center justify-center gap-1 rounded-full transition-all',
          buttonStyles.container,
          isLoading && 'opacity-50',
          Platform.OS === 'web' && 'hover:scale-105 active:scale-95',
          className
        )}
        style={({ pressed }) => ({
          transform:
            Platform.OS !== 'web' && pressed ? [{ scale: 0.95 }] : undefined,
        })}
      >
        {/* Icon */}
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isUpvoted ? main : '#6b7280'}
            className={iconSize}
          />
        ) : isUpvoted ? (
          <ArrowUpCircleSolid
            className={cn(iconSize, Platform.OS === 'web' ? 'text-main' : '')}
            color={Platform.OS !== 'web' ? main : undefined}
            accessibilityLabel="Upvoted"
          />
        ) : (
          <ArrowUpCircleOutline
            className={cn(iconSize, 'text-gray-600 dark:text-gray-400')}
            accessibilityLabel="Upvote"
          />
        )}

        {/* Label and Count */}
        {showCount && (
          <Text
            className={cn(
              'font-medium',
              textSize,
              isUpvoted
                ? Platform.OS === 'web'
                  ? 'text-main'
                  : ''
                : 'text-gray-700 dark:text-gray-300'
            )}
            style={
              isUpvoted && Platform.OS !== 'web' ? { color: main } : undefined
            }
            numberOfLines={1}
          >
            {isUpvoted ? t`Upvoted` : t`Upvote`}
            {displayCount > 0 && ` (${formatUpvoteCount(displayCount)})`}
          </Text>
        )}
      </Pressable>

      {/* Sign-in Dialog for Anonymous Users */}
      <AlertDialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Sign In Required</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                Please sign in to upvote contests and show your support!
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>
                <Trans>Cancel</Trans>
              </Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleSignIn}>
              <Text>
                <Trans>Sign In</Trans>
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Helper function to get error message
function getErrorMessage(error: Error | null): string {
  if (!error) return ''

  const message = error.message.toLowerCase()

  if (message.includes('not authenticated') || message.includes('401')) {
    return i18n._(msg`Please log in to upvote contests`)
  }

  if (message.includes('already upvoted') || message.includes('409')) {
    return i18n._(msg`You've already upvoted this contest`)
  }

  if (message.includes('network') || message.includes('fetch')) {
    return i18n._(
      msg`Unable to upvote. Please check your connection and try again`
    )
  }

  return i18n._(msg`Something went wrong. Please try again`)
}

// Helper function to get button styles based on variant
function getButtonStyles(variant: 'default' | 'compact' | 'large') {
  switch (variant) {
    case 'compact':
      return {
        container: 'px-2 py-1',
      }
    case 'large':
      return {
        container: 'px-4 py-2',
      }
    case 'default':
    default:
      return {
        container: 'px-3 py-1.5',
      }
  }
}

// Helper function to get icon size based on variant
function getIconSize(variant: 'default' | 'compact' | 'large'): string {
  switch (variant) {
    case 'compact':
      return 'w-5 h-5' // Increased from w-4 h-4
    case 'large':
      return 'w-7 h-7'
    case 'default':
    default:
      return 'w-5 h-5'
  }
}

// Helper function to get text size based on variant
function getTextSize(variant: 'default' | 'compact' | 'large'): string {
  switch (variant) {
    case 'compact':
      return 'text-sm' // Increased from text-xs
    case 'large':
      return 'text-lg'
    case 'default':
    default:
      return 'text-sm'
  }
}
