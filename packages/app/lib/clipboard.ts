import { Platform } from 'react-native'

/**
 * Cross-platform clipboard utility
 * Uses navigator.clipboard on web
 * On native, requires expo-clipboard (install with: npx expo install expo-clipboard)
 */

/**
 * Read text from the clipboard. Returns null when unavailable (permission
 * denied, no expo-clipboard on native, or empty clipboard).
 */
export async function readFromClipboard(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const text = await navigator.clipboard.readText()
      return text || null
    } catch (error) {
      console.error('Failed to read clipboard:', error)
      return null
    }
  }
  try {
    // @ts-ignore - expo-clipboard may not be installed during development
    const ExpoClipboard = await import('expo-clipboard')
    const text = await ExpoClipboard.getStringAsync()
    return text || null
  } catch {
    console.warn(
      'Clipboard not available. Install expo-clipboard with: npx expo install expo-clipboard'
    )
    return null
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textArea)
        return success
      } catch {
        return false
      }
    }
  } else {
    // For native, try dynamic import of expo-clipboard
    try {
      // @ts-ignore - expo-clipboard may not be installed during development
      const ExpoClipboard = await import('expo-clipboard')
      await ExpoClipboard.setStringAsync(text)
      return true
    } catch {
      // If no clipboard module available, log warning
      console.warn(
        'Clipboard not available. Install expo-clipboard with: npx expo install expo-clipboard'
      )
      return false
    }
  }
}
