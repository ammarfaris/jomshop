import { SafeArea } from 'app/provider/safe-area'
import { AuthProvider, useAuth } from 'app/contexts/AuthContext'
import { TextScaleProvider } from 'app/contexts/TextScaleContext'
import { ColorThemeProvider } from 'app/contexts/ColorThemeContext'
import { SubscriptionProvider } from 'app/contexts/SubscriptionContext'
import { PointsProvider } from 'app/contexts/PointsContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@lingui/react'
// import { I18nProvider, TransRenderProps } from '@lingui/react'
// import { Text } from 'app/components/ui/text'
import { i18n, defaultLocale, activateLocale } from 'app/lib/lingui/i18n'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useOAuthCallback } from 'app/hooks/useOAuthCallback'
import { useThemeSync } from 'app/hooks/useThemeSync'
import { Toaster } from 'app/lib/sonner-universal'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { getUserPrefs } from 'app/lib/prefs'

// for React Query
const queryClient = new QueryClient()

// for Lingui
// const DefaultComponent = (props: TransRenderProps) => {
//   return <Text>{props.children}</Text>
// }

// Component to handle i18n activation properly for SSR/hydration
function I18nProviderWrapper({ children }: { children: React.ReactNode }) {
  const [isI18nLoaded, setIsI18nLoaded] = useState(Platform.OS !== 'web')
  const { user, isLoading } = useAuth()

  // Handle post-OAuth callback to download profile picture
  useOAuthCallback()

  // Sync theme from Appwrite when user logs in (web only, native follows system)
  useThemeSync() // Hook always called, but will be no-op on native

  useEffect(() => {
    // Ensure i18n is activated on the client side
    if (!i18n.locale) {
      i18n.activate(defaultLocale)
    }
    setIsI18nLoaded(true)
  }, [])

  useEffect(() => {
    // Load the saved language preference from the backend (only if signed in).
    if (!isLoading && user) {
      ;(async () => {
        try {
          const prefs = await getUserPrefs()
          const lang = (prefs as any)?.language
          if (lang === 'en' || lang === 'ms') {
            activateLocale(lang)
          }
        } catch {
          // ignore if prefs unavailable
        }
      })()
    }
  }, [user, isLoading])

  // Always render with I18nProvider after initial load/activation
  // we comment this out because we want to use without defaultComponent, but remember to have <Trans> inside <Text> or <Text> inside <Trans>
  // if (isI18nLoaded) {
  //   return (
  //     <I18nProvider i18n={i18n} defaultComponent={DefaultComponent}>
  //       {children}
  //     </I18nProvider>
  //   )
  // }

  // Always render with I18nProvider after initial load/activation
  if (isI18nLoaded) {
    return <I18nProvider i18n={i18n}>{children}</I18nProvider>
  }

  // For web during hydration, return children without I18nProvider until loaded
  return <>{children}</>
}

export function Provider({ children }: { children: React.ReactNode }) {
  const { isDarkColorScheme } = useColorScheme()

  return (
    <Providers>
      {children}
      <Toaster
        theme={isDarkColorScheme ? 'light' : 'dark'}
        duration={1500}
        position="top-center"
      />
    </Providers>
  )
}

// Compose multiple providers into a single provider component.
// Ensures the return value is typed as React.FC with a generic ReactNode child.
const compose = (
  providers: React.FC<{ children: React.ReactNode }>[]
): React.FC<{ children: React.ReactNode }> => {
  // Identity component renders children as-is.
  const Identity: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>{children}</>
  )

  return providers.reduce<React.FC<{ children: React.ReactNode }>>(
    (Prev, Curr) => {
      const Combined: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => (
        <Prev>
          <Curr>{children}</Curr>
        </Prev>
      )
      return Combined
    },
    Identity
  )
}

const Providers = compose([
  AuthProvider,
  SubscriptionProvider,
  PointsProvider,
  TextScaleProvider,
  ColorThemeProvider,
  SafeArea,
  ({ children }) => (
    <I18nProviderWrapper>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProviderWrapper>
  ),
])
