import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import {
  checkUserUpvote,
  getUpvoteCount,
  createUpvote,
  removeUpvote,
} from 'app/lib/upvotes/api'

/**
 * Hook to check if the current user has upvoted a contest
 * @param contestId - The contest ID
 * @returns Object with isUpvoted, isLoading, and error states
 */
export function useUpvoteStatus(contestId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['upvote', 'status', contestId, user?.$id],
    queryFn: async () => {
      // If user is not authenticated, return false
      if (!user?.$id) {
        return false
      }
      return checkUserUpvote(contestId, user.$id)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!contestId, // Only run query if contestId exists
  })
}

/**
 * Hook to get the upvote count for a contest
 * @param contestId - The contest ID
 * @returns Object with count, isLoading, and error states
 */
export function useUpvoteCount(contestId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['upvote', 'count', contestId],
    queryFn: () => getUpvoteCount(contestId),
    staleTime: 1 * 60 * 1000, // 1 minute
    // Only run query if contestId exists AND user is authenticated
    // For anonymous users, the initialCount prop will be used instead
    enabled: !!contestId && !!user,
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
