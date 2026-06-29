import { Uniwind, useUniwind } from 'uniwind'
import type { UseColorSchemeReturn } from './useColorScheme'

export type { ThemeMode } from './useColorScheme'

/**
 * Native color-scheme hook (Uniwind-backed).
 *
 * Uniwind cold-starts in adaptive mode (follows the OS); `useUniwind().theme`
 * is always the resolved scheme ('light' | 'dark'). Setters drive Uniwind
 * directly. The web implementation lives in `useColorScheme.web.tsx`.
 */
export function useColorScheme(): UseColorSchemeReturn {
  const { theme } = useUniwind()
  const colorScheme = (theme ?? 'dark') as 'dark' | 'light'

  return {
    colorScheme,
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme: (scheme: 'dark' | 'light') => Uniwind.setTheme(scheme),
    toggleColorScheme: () =>
      Uniwind.setTheme(colorScheme === 'dark' ? 'light' : 'dark'),
  }
}
