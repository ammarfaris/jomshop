import { useParams } from 'solito/navigation'

/**
 * Web route params. solito's `useParams` works correctly on web (it reads from
 * Next's App Router), so keep using it there. Falls back to an empty object so
 * callers can always safely read `.id`.
 */
export function useRouteParams<
  T extends Record<string, string> = Record<string, string>,
>(): Partial<T> {
  return (useParams() ?? {}) as Partial<T>
}
