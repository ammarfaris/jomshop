import './globals.css'
import './text-scale.css'
import { StylesProvider } from './styles-provider'
import { ThemeProvider } from './theme-provider'
import { ThemeMetaTags } from './theme-meta-tags'
import Navbar from './navbar'
import Script from 'next/script'

// Google AdSense Publisher ID for JomContest
// Can be overridden via environment variable NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
const ADSENSE_PUBLISHER_ID =
  process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'ca-pub-3985532721810420'

export const metadata = {
  title: 'JomContest',
  description: 'Contest discovery made easy, Winning made possible!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
        />
        <meta name="text-scale-version" content="2.0" />
        {/* Google AdSense site verification meta tag */}
        <meta name="google-adsense-account" content="ca-pub-3985532721810420" />
        {/* Blocking script to apply color theme before React loads - prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var colorTheme = localStorage.getItem('colorTheme');
                  if (colorTheme === 'blue' || colorTheme === 'green' || colorTheme === 'purple') {
                    document.documentElement.classList.remove('theme-green', 'theme-blue', 'theme-purple');
                    document.documentElement.classList.add('theme-' + colorTheme);
                  } else {
                    // Default to green if no preference
                    document.documentElement.classList.add('theme-green');
                  }
                } catch (e) {
                  // Fallback to green on error
                  document.documentElement.classList.add('theme-green');
                }
              })();
            `,
          }}
        />
        {/* Google AdSense Script - only load if publisher ID is configured */}
        {ADSENSE_PUBLISHER_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeMetaTags />
          <StylesProvider>
            <Navbar maintenanceMode={isMaintenanceMode} />
            {children}
          </StylesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
