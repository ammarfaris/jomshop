import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import {
  checkUserSave,
  removeSave,
  getUserSavedContests,
  saveWithAutoUpvote,
  type SaveWithAutoUpvoteResult,
} from 'app/lib/saves/api'

/**
 * Hook to check if the current user has saved a contest
 * @param contestId - The contest ID
 * @returns Object with isSaved, isLoading, and error states
 */
export function useSaveStatus(contestId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['save', 'status', contestId, user?.$id],
    queryFn: async () => {
      // If user is not authenticated, return false
      if (!user?.$id) {
        return false
      }
      return checkUserSave(contestId, user.$id)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!contestId, // Only run query if contestId exists
  })
}

/**
 * Hook to handle save and remove save actions with optimistic updates
 * Includes automatic upvote integration when saving
 * @param contestId - The contest ID
 * @returns Object with save, removeSave functions and loading/error states
 */
export function useSaveActions(contestId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (): Promise<SaveWithAutoUpvoteResult> => {
      if (!user?.$id) {
        throw new Error('User not authenticated')
      }
      // Save contest and automatically upvote if not already upvoted
      return saveWithAutoUpvote(contestId, user.$id)
    },
    onMutate: async () => {
      // OPTIMISTIC UPDATE: Update UI immediately before API call completes
      // This provides instant feedback to the user

      // Cancel any outgoing refetches for save status to avoid race conditions
      await queryClient.cancelQueries({
        queryKey: ['save', 'status', contestId, user?.$id],
      })

      // Snapshot the previous save status for potential rollback
      const previousSaveStatus = queryClient.getQueryData([
        'save',
        'status',
        contestId,
        user?.$id,
      ])

      // Optimistically update save status to true (immediate UI feedback)
      queryClient.setQueryData(['save', 'status', contestId, user?.$id], true)

      // Return context with previous values for rollback on error
      return { previousSaveStatus }
    },
    onSuccess: (result) => {
      // If auto-upvote occurred, invalidate upvote queries
      if (result.autoUpvoted) {
        queryClient.invalidateQueries({
          queryKey: ['upvote', 'status', contestId, user?.$id],
        })
        queryClient.invalidateQueries({
          queryKey: ['upvote', 'count', contestId],
        })
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous save status on error
      if (context?.previousSaveStatus !== undefined) {
        queryClient.setQueryData(
          ['save', 'status', contestId, user?.$id],
          context.previousSaveStatus
        )
      }
    },
    onSettled: () => {
      // Invalidate and refetch save status after mutation completes
      queryClient.invalidateQueries({
        queryKey: ['save', 'status', contestId, user?.$id],
      })
      // Also invalidate user's saved contests list
      queryClient.invalidateQueries({
        queryKey: ['saves', 'user', user?.$id],
      })
      // Always invalidate upvote queries to ensure sync across devices
      // (in case the contest was already saved+upvoted from another device)
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'status', contestId, user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['upvote', 'count', contestId],
      })
    },
  })

  const removeSaveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.$id) {
        throw new Error('User not authenticated')
      }
      // Remove save document
      await removeSave(contestId, user.$id)
    },
    onMutate: async () => {
      // Cancel any outgoing refetches for save status
      await queryClient.cancelQueries({
        queryKey: ['save', 'status', contestId, user?.$id],
      })

      // Snapshot the previous save status
      const previousSaveStatus = queryClient.getQueryData([
        'save',
        'status',
        contestId,
        user?.$id,
      ])

      // Optimistically update save status to false
      queryClient.setQueryData(['save', 'status', contestId, user?.$id], false)

      // Optimistically update receipt count to 0 (since receipts will be archived)
      queryClient.setQueryData(['receipts', 'count', contestId, user?.$id], 0)

      // Return context with previous values for rollback
      return { previousSaveStatus }
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous save status on error
      if (context?.previousSaveStatus !== undefined) {
        queryClient.setQueryData(
          ['save', 'status', contestId, user?.$id],
          context.previousSaveStatus
        )
      }
    },
    onSettled: () => {
      // Invalidate and refetch save status after mutation completes
      queryClient.invalidateQueries({
        queryKey: ['save', 'status', contestId, user?.$id],
      })
      // Also invalidate user's saved contests list
      queryClient.invalidateQueries({
        queryKey: ['saves', 'user', user?.$id],
      })
      // Invalidate receipt count queries (receipts were archived)
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'count', contestId, user?.$id],
      })
      // Also invalidate contest receipts query
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'contest', contestId, user?.$id],
      })
      // Invalidate receipt stats (total contests with receipts may have changed)
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'stats', user?.$id],
      })
    },
  })

  return {
    save: saveMutation.mutate,
    removeSave: removeSaveMutation.mutate,
    isLoading: saveMutation.isPending || removeSaveMutation.isPending,
    error: saveMutation.error || removeSaveMutation.error,
    saveResult: saveMutation.data,
  }
}

/**
 * Hook to fetch user's saved contests with pagination support
 * @returns Object with savedContests array, isLoading, error, refetch, and pagination functions
 */
export function useUserSavedContests() {
  const { user } = useAuth()

  return useInfiniteQuery({
    queryKey: ['saves', 'user', user?.$id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user?.$id) {
        return []
      }
      return getUserSavedContests(user.$id, {
        limit: 20,
        offset: pageParam,
      })
    },
    getNextPageParam: (lastPage, allPages) => {
      // If the last page has fewer items than the limit, we've reached the end
      if (lastPage.length < 20) {
        return undefined
      }
      // Return the offset for the next page
      return allPages.length * 20
    },
    initialPageParam: 0,
    staleTime: 30 * 1000, // 30 seconds - refetch more often to ensure fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    enabled: !!user?.$id, // Only run query if user is authenticated
  })
}
