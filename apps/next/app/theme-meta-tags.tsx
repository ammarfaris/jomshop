'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

/**
 * Component that manages theme-color and color-scheme meta tags for Safari iOS
 * status bar/notch coloring and overall browser UI theming
 */
export function ThemeMetaTags() {
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    // Get the actual resolved theme (handles system theme detection)
    const currentTheme = resolvedTheme || theme

    // Define theme colors for status bar/notch
    // For Safari iOS, these control the color of the status bar and notch area
    // Using solid colors that work well with Safari's theming system
    const themeColors = {
      light: '#ffffff', // Pure white for light theme status bar
      dark: '#000000',  // Pure black for dark theme status bar
    }

    // Update theme-color meta tag for Safari iOS status bar
    const updateMetaTag = (name: string, content: string) => {
      let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement

      if (!metaTag) {
        // Create meta tag if it doesn't exist
        metaTag = document.createElement('meta')
        metaTag.name = name
        document.head.appendChild(metaTag)
      }

      metaTag.content = content
    }

    // Update color-scheme meta tag to indicate supported schemes
    updateMetaTag('color-scheme', 'light dark')

    // Update theme-color meta tag based on current theme
    if (currentTheme === 'dark') {
      updateMetaTag('theme-color', themeColors.dark)
    } else if (currentTheme === 'light') {
      updateMetaTag('theme-color', themeColors.light)
    } else if (currentTheme === 'system') {
      // For system theme, use the resolved theme
      const resolved = resolvedTheme === 'dark' ? themeColors.dark : themeColors.light
      updateMetaTag('theme-color', resolved)
    }

  }, [theme, resolvedTheme])

  // This component doesn't render anything visible
  return null
}
