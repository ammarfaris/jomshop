import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import {
  uploadReceiptSupabase,
  getContestReceiptsSupabase,
  getUserReceiptStatsSupabase,
  getContestReceiptCountSupabase,
  updateReceiptNotesSupabase,
  deleteReceiptSupabase,
  getReceiptSignedUrlsSupabase,
  type Receipt,
  type ReceiptStats,
  type ReceiptUploadResult,
} from 'app/lib/supabase'

/**
 * Hook to fetch receipts for a specific contest
 */
export function useContestReceipts(contestId: string) {
  const { user } = useAuth()

  return useQuery<Receipt[]>({
    queryKey: ['receipts', 'contest', contestId, user?.$id],
    queryFn: async () => {
      if (!user?.$id) throw new Error('User not authenticated')
      return getContestReceiptsSupabase(contestId)
    },
    enabled: !!user?.$id && !!contestId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook that resolves displayable URLs for a set of receipts.
 * - Supabase: ONE batched `createSignedUrls` request (owner-scoped, ~1h TTL).
 * - Appwrite: synchronous file view URLs.
 * Returns a map keyed by `file_id`.
 */
export function useReceiptSignedUrls(receipts: Receipt[]) {
  const { user } = useAuth()
  const fileIds = receipts.map((r) => r.file_id)
  const fileIdsKey = [...fileIds].sort().join(',')

  return useQuery<Record<string, string>>({
    queryKey: ['receipts', 'urls', user?.$id, fileIdsKey],
    queryFn: async () => {
      if (fileIds.length === 0) return {}
      return getReceiptSignedUrlsSupabase(fileIds)
    },
    enabled: !!user?.$id && receipts.length > 0,
    // Refresh comfortably before the 1h signed-URL expiry.
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Hook to fetch user's receipt statistics
 */
export function useReceiptStats() {
  const { user } = useAuth()

  return useQuery<ReceiptStats>({
    queryKey: ['receipts', 'stats', user?.$id],
    queryFn: async () => {
      if (!user?.$id) throw new Error('User not authenticated')
      return getUserReceiptStatsSupabase()
    },
    enabled: !!user?.$id,
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
    queryKey: ['receipts', 'count', contestId, user?.$id],
    queryFn: async () => {
      if (!user?.$id) return 0
      return getContestReceiptCountSupabase(contestId)
    },
    enabled: !!user?.$id && !!contestId,
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
      return uploadReceiptSupabase(
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
      return updateReceiptNotesSupabase(receiptId, notes)
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
      return deleteReceiptSupabase(receiptId, fileId)
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
