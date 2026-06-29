import { useLocalSearchParams } from 'expo-router'

/**
 * Native route params.
 *
 * We intentionally bypass solito's `useParams` here. Under expo-router 56,
 * solito's App-Router `useParams` reads the route straight from React
 * Navigation's `NavigationRouteContext` and gets `undefined`, so it returns
 * `undefined` and the detail screens crash with
 * "Cannot read property 'id' of undefined". `useLocalSearchParams` is the
 * canonical expo-router API and always returns the active route's params.
 */
export function useRouteParams<
  T extends Record<string, string> = Record<string, string>,
>(): Partial<T> {
  return useLocalSearchParams() as Partial<T>
}
