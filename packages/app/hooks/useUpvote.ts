import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import { BACKEND } from 'app/lib/backend'
import {
  checkUserUpvote,
  getUpvoteCount,
  createUpvote,
  removeUpvote,
} from 'app/lib/upvotes/api'
import {
  checkUserUpvoteSupabase,
  getUpvoteCountSupabase,
  createUpvoteSupabase,
  removeUpvoteSupabase,
} from 'app/lib/supabase'
import { useIsContestBatched } from 'app/contexts/EngagementContext'

/**
 * Hook to check if the current user has upvoted a contest
 * @param contestId - The contest ID
 * @returns Object with isUpvoted, isLoading, and error states
 */
export function useUpvoteStatus(contestId: string) {
  const { user } = useAuth()
  // On list screens an EngagementProvider batch-seeds this cache, so the per-card
  // query stays disabled (no N+1) and reads the seeded value instead.
  const isBatched = useIsContestBatched(contestId)

  return useQuery({
    queryKey: ['upvote', 'status', contestId, user?.$id],
    queryFn: async () => {
      // If user is not authenticated, return false
      if (!user?.$id) {
        return false
      }
      return BACKEND === 'supabase'
        ? checkUserUpvoteSupabase(contestId)
        : checkUserUpvote(contestId, user.$id)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!contestId && !!user && !isBatched,
  })
}

/**
 * Hook to get the upvote count for a contest
 * @param contestId - The contest ID
 * @returns Object with count, isLoading, and error states
 */
export function useUpvoteCount(contestId: string) {
  const { user } = useAuth()
  // Only Supabase seeds the count cache from the list payload (its contest rows
  // carry `upvote_count`). Appwrite list rows don't, so we must still fetch the
  // count per card there or batched cards would render 0.
  const isCountSeeded = useIsContestBatched(contestId) && BACKEND === 'supabase'

  return useQuery({
    queryKey: ['upvote', 'count', contestId],
    queryFn: () =>
      BACKEND === 'supabase'
        ? getUpvoteCountSupabase(contestId)
        : getUpvoteCount(contestId),
    staleTime: 1 * 60 * 1000, // 1 minute
    // Only run query if contestId exists AND user is authenticated.
    // Anonymous users fall back to the initialCount prop; on Supabase, batched
    // (list) cards read the count seeded by EngagementProvider.
    enabled: !!contestId && !!user && !isCountSeeded,
  })
}

/**
 * Hook to handle upvote and remove upvote actions with optimistic updates
 * @param contestId - The contest ID
 * @returns Object with upvote, removeUpvote functions and loading/error states
 */
export function useUpvoteActions(contestId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.$id) {
        throw new Error('User not authenticated')
      }
      if (BACKEND === 'supabase') {
        await createUpvoteSupabase(contestId)
        return
      }
      // Create upvote document
      await createUpvote(contestId, user.$id)
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['upvote', 'status', contestId, user?.$id],
      })
      await queryClient.cancelQueries({
        queryKey: ['upvote', 'count', contestId],
      })

      // Snapshot the previous values
      const previousStatus = queryClient.getQueryData([
        'upvote',
        'status',
        contestId,
        user?.$id,
      ])
      const previousCount = queryClient.getQueryData([
        'upvote',
        'count',
        contestId,
      ])

      // Optimistically update to the new values
      queryClient.setQueryData(['upvote', 'status', contestId, user?.$id], true)
      queryClient.setQueryData(
        ['upvote', 'count', contestId],
        (old: number | undefined) => (old || 0) + 1
      )

      // Return context with previous values for rollback
      return { previousStatus, previousCount }
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous values on error
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(
          ['upvote', 'status', contestId, user?.$id],
          context.previousStatus
        )
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          ['upvote', 'count', contestId],
          context.previousCount
        )
      }
    },
    onSettled: () => {
      // Invalidate and refetch after mutation completes
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'status', contestId, user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'count', contestId],
      })
    },
  })

  const removeUpvoteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.$id) {
        throw new Error('User not authenticated')
      }
      if (BACKEND === 'supabase') {
        await removeUpvoteSupabase(contestId)
        return
      }
      // Remove upvote document
      await removeUpvote(contestId, user.$id)
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['upvote', 'status', contestId, user?.$id],
      })
      await queryClient.cancelQueries({
        queryKey: ['upvote', 'count', contestId],
      })

      // Snapshot the previous values
      const previousStatus = queryClient.getQueryData([
        'upvote',
        'status',
        contestId,
        user?.$id,
      ])
      const previousCount = queryClient.getQueryData([
        'upvote',
        'count',
        contestId,
      ])

      // Optimistically update to the new values
      queryClient.setQueryData(
        ['upvote', 'status', contestId, user?.$id],
        false
      )
      queryClient.setQueryData(
        ['upvote', 'count', contestId],
        (old: number | undefined) => Math.max((old || 0) - 1, 0)
      )

      // Return context with previous values for rollback
      return { previousStatus, previousCount }
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous values on error
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(
          ['upvote', 'status', contestId, user?.$id],
          context.previousStatus
        )
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          ['upvote', 'count', contestId],
          context.previousCount
        )
      }
    },
    onSettled: () => {
      // Invalidate and refetch after mutation completes
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'status', contestId, user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'count', contestId],
      })
    },
  })

  return {
    upvote: upvoteMutation.mutate,
    removeUpvote: removeUpvoteMutation.mutate,
    isLoading: upvoteMutation.isPending || removeUpvoteMutation.isPending,
    error: upvoteMutation.error || removeUpvoteMutation.error,
  }
}
