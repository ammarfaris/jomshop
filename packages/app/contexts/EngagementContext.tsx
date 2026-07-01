import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'app/contexts/AuthContext'
import { fetchEngagementBatchSupabase } from 'app/lib/supabase'

/**
 * Batches the current user's upvote/save status for a whole list of contests
 * into TWO queries and seeds the per-card React Query caches, so the per-card
 * `useUpvoteStatus` / `useUpvoteCount` / `useSaveStatus` hooks can stay disabled
 * on lists (avoiding the 3-queries-per-card N+1) while still rendering the right
 * state and keeping optimistic updates working (same cache keys).
 */

type EngagementContextValue = {
  batchedIds: Set<string>
  /** True when the batch query failed, so per-card hooks should fetch themselves. */
  failed: boolean
}

const EngagementContext = createContext<EngagementContextValue | null>(null)

export function EngagementProvider({
  contests,
  children,
}: {
  contests: { $id: string; upvote_count?: number }[]
  children: ReactNode
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const ids = useMemo(
    () => Array.from(new Set(contests.map((c) => c.$id))).sort(),
    [contests],
  )
  const idsKey = ids.join(',')

  // Seed per-card upvote COUNT caches from the list payload (no auth needed).
  // `old ?? value` never clobbers an optimistic/fresher value already in cache.
  useEffect(() => {
    contests.forEach((c) => {
      if (typeof c.upvote_count === 'number') {
        queryClient.setQueryData(
          ['upvote', 'count', c.$id],
          (old: number | undefined) => old ?? c.upvote_count,
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const { data, isError } = useQuery({
    queryKey: ['engagement', 'batch', user?.$id, idsKey],
    queryFn: () => fetchEngagementBatchSupabase(ids),
    enabled: !!user?.$id && ids.length > 0,
    staleTime: 60 * 1000,
  })

  // Seed per-card STATUS caches with server truth once the batch resolves.
  // Use `old ?? value` so a late/stale batch response can never clobber an
  // optimistic upvote/save the user just made (the per-card queries are disabled
  // while batched, so they won't refetch to self-correct). Mutations write the
  // same keys directly and remain the source of truth after the first seed.
  useEffect(() => {
    if (!data || !user?.$id) return
    ids.forEach((id) => {
      queryClient.setQueryData(
        ['upvote', 'status', id, user.$id],
        (old: boolean | undefined) => old ?? data.upvoted.has(id),
      )
      queryClient.setQueryData(
        ['save', 'status', id, user.$id],
        (old: boolean | undefined) => old ?? data.saved.has(id),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, user?.$id, idsKey])

  const value = useMemo<EngagementContextValue>(
    () => ({ batchedIds: new Set(ids), failed: isError }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, isError],
  )

  return (
    <EngagementContext.Provider value={value}>
      {children}
    </EngagementContext.Provider>
  )
}

/**
 * True when this contest's engagement is provided by a surrounding
 * EngagementProvider (i.e. its status/count caches are batch-seeded). Per-card
 * hooks use this to skip their own network fetch.
 */
export function useIsContestBatched(contestId: string): boolean {
  const ctx = useContext(EngagementContext)
  // If the batch failed, report "not batched" so the per-card hooks re-enable and
  // fetch their own status/count instead of waiting forever on a seed that never came.
  return !!ctx && !ctx.failed && ctx.batchedIds.has(contestId)
}
