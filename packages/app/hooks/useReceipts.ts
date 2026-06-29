import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import { BACKEND } from 'app/lib/backend'
import {
  getContestReceipts,
  getUserReceiptStats,
  getContestReceiptCount,
  uploadReceipt,
  updateReceiptNotes,
  deleteReceipt,
  type Receipt,
  type ReceiptStats,
  type ReceiptUploadResult,
} from 'app/lib/receipts/api'

/**
 * Hook to fetch receipts for a specific contest
 */
export function useContestReceipts(contestId: string) {
  const { user } = useAuth()

  return useQuery<Receipt[]>({
    queryKey: ['receipts', 'contest', BACKEND, contestId, user?.$id],
    queryFn: async () => {
      if (BACKEND !== 'appwrite') return []
      if (!user?.$id) throw new Error('User not authenticated')
      return getContestReceipts(user.$id, contestId)
    },
    enabled: !!user?.$id && !!contestId && BACKEND === 'appwrite',
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch user's receipt statistics
 */
export function useReceiptStats() {
  const { user } = useAuth()

  return useQuery<ReceiptStats>({
    queryKey: ['receipts', 'stats', BACKEND, user?.$id],
    queryFn: async () => {
      if (BACKEND !== 'appwrite') {
        return {
          totalContestsWithReceipts: 0,
          contestsWithReceipts: [],
        } as ReceiptStats
      }
      if (!user?.$id) throw new Error('User not authenticated')
      return getUserReceiptStats(user.$id)
    },
    enabled: !!user?.$id && BACKEND === 'appwrite',
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch receipt count for a specific contest
 */
export function useContestReceiptCount(contestId: string) {
  const { user } = useAuth()

  return useQuery<number>({
    queryKey: ['receipts', 'count', BACKEND, contestId, user?.$id],
    queryFn: async () => {
      if (BACKEND !== 'appwrite') return 0
      if (!user?.$id) return 0
      return getContestReceiptCount(user.$id, contestId)
    },
    enabled: !!user?.$id && !!contestId && BACKEND === 'appwrite',
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// useAppSettings hook removed - limits now come from SubscriptionContext

/**
 * Hook to upload a receipt
 */
export function useUploadReceipt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ReceiptUploadResult,
    Error,
    {
      contestId: string
      file: File | { uri: string; name: string; type: string }
      notes: string
      fileOrder: number
      fileType: string
      captchaToken?: string
    }
  >({
    mutationFn: async ({
      contestId,
      file,
      notes,
      fileOrder,
      fileType,
      captchaToken,
    }) => {
      if (!user?.$id) throw new Error('User not authenticated')
      return uploadReceipt(
        user.$id,
        contestId,
        file,
        notes,
        fileOrder,
        fileType,
        captchaToken
      )
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'contest', variables.contestId, user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'stats', user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'count', variables.contestId, user?.$id],
      })
      // Invalidate the counts query used in profile screen
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'counts', user?.$id],
      })
    },
  })
}

/**
 * Hook to update receipt notes with server-side sanitization
 */
export function useUpdateReceipt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    Receipt,
    Error,
    { receiptId: string; contestId: string; notes: string }
  >({
    mutationFn: async ({ receiptId, notes }) => {
      if (!user?.$id) throw new Error('User not authenticated')
      return updateReceiptNotes(receiptId, user.$id, notes)
    },
    onMutate: async ({ receiptId, contestId, notes }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['receipts', 'contest', contestId, user?.$id],
      })

      // Snapshot the previous value
      const previousReceipts = queryClient.getQueryData<Receipt[]>([
        'receipts',
        'contest',
        contestId,
        user?.$id,
      ])

      // Optimistically update
      queryClient.setQueryData<Receipt[]>(
        ['receipts', 'contest', contestId, user?.$id],
        (old) =>
          old?.map((receipt) =>
            receipt.$id === receiptId ? { ...receipt, notes } : receipt
          )
      )

      return { previousReceipts }
    },
    onError: (_err, variables, context: any) => {
      // Rollback on error
      if (context?.previousReceipts) {
        queryClient.setQueryData(
          ['receipts', 'contest', variables.contestId, user?.$id],
          context.previousReceipts
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'contest', variables.contestId, user?.$id],
      })
    },
  })
}

/**
 * Hook to delete a receipt
 */
export function useDeleteReceipt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    void,
    Error,
    { receiptId: string; fileId: string; contestId: string }
  >({
    mutationFn: async ({ receiptId, fileId }) => {
      return deleteReceipt(receiptId, fileId)
    },
    onMutate: async ({ receiptId, contestId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['receipts', 'contest', contestId, user?.$id],
      })

      // Snapshot the previous value
      const previousReceipts = queryClient.getQueryData<Receipt[]>([
        'receipts',
        'contest',
        contestId,
        user?.$id,
      ])

      // Optimistically remove the receipt
      queryClient.setQueryData<Receipt[]>(
        ['receipts', 'contest', contestId, user?.$id],
        (old) => old?.filter((receipt) => receipt.$id !== receiptId)
      )

      return { previousReceipts }
    },
    onError: (_err, variables, context: any) => {
      // Rollback on error
      if (context?.previousReceipts) {
        queryClient.setQueryData(
          ['receipts', 'contest', variables.contestId, user?.$id],
          context.previousReceipts
        )
      }
    },
    onSuccess: (_data, variables) => {
      // Invalidate stats and count queries
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'stats', user?.$id],
      })
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'count', variables.contestId, user?.$id],
      })
      // Invalidate the counts query used in profile screen
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'counts', user?.$id],
      })
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['receipts', 'contest', variables.contestId, user?.$id],
      })
    },
  })
}
