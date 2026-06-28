import { useColorScheme as useRNColorScheme } from 'react-native'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface UseColorSchemeReturn {
  colorScheme: 'dark' | 'light'
  isDarkColorScheme: boolean
  setColorScheme: (scheme: 'dark' | 'light') => void
  toggleColorScheme: () => void
  // Web-only (next-themes). Optional so shared code can feature-detect them;
  // they are `undefined` on native, where the app follows the system theme.
  themeMode?: ThemeMode
  setThemeMode?: (mode: ThemeMode) => void
}

/**
 * Canonical types + safe fallback for the color-scheme hook.
 *
 * Platform builds override this file:
 *  - native: `useColorScheme.native.ts` (Uniwind)
 *  - web:    `useColorScheme.web.tsx` (next-themes)
 *
 * TypeScript uses classic resolution and picks THIS file, so it is the single
 * source of truth for the hook's return shape across the monorepo.
 */
export function useColorScheme(): UseColorSchemeReturn {
  const scheme = (useRNColorScheme() ?? 'dark') as 'dark' | 'light'

  return {
    colorScheme: scheme,
    isDarkColorScheme: scheme === 'dark',
    setColorScheme: () => {},
    toggleColorScheme: () => {},
  }
}
