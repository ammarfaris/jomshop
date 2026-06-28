// we add theme-provider so that we don't need to 'use client' on at layout.tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { PortalHost } from '@rn-primitives/portal' // for rnr Alert Dialog and other (https://reactnativereusables.com/components/alert-dialog/)

import { Provider } from 'app/provider'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <Provider>
        {children}
        <PortalHost />
      </Provider>
    </NextThemesProvider>
  )
}
