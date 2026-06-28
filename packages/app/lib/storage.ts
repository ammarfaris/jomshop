import { Platform } from 'react-native'

// Cross-platform storage utility that works on both web and native
export class Storage {
  private static asyncStorage: any = null

  private static getAsyncStorage() {
    if (Platform.OS === 'web') {
      // Web: use localStorage
      return {
        getItem: (key: string) => {
          try {
            return Promise.resolve(localStorage.getItem(key))
          } catch (error) {
            console.warn(
              '[Storage] Failed to get item from localStorage:',
              error
            )
            return Promise.resolve(null)
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value)
            return Promise.resolve()
          } catch (error) {
            console.warn('[Storage] Failed to set item in localStorage:', error)
            return Promise.resolve()
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key)
            return Promise.resolve()
          } catch (error) {
            console.warn(
              '[Storage] Failed to remove item from localStorage:',
              error
            )
            return Promise.resolve()
          }
        },
      }
    } else {
      // Native: use AsyncStorage
      if (!this.asyncStorage) {
        try {
          this.asyncStorage = require('@react-native-async-storage/async-storage')
        } catch (error) {
          console.warn('[Storage] AsyncStorage not available:', error)
          return null
        }
      }
      return this.asyncStorage.default || this.asyncStorage
    }
  }

  static async getItem(key: string): Promise<string | null> {
    const storage = await this.getAsyncStorage()
    if (!storage) return null

    try {
      return await storage.getItem(key)
    } catch (error) {
      console.warn(`[Storage] Failed to get item "${key}":`, error)
      return null
    }
  }

  static async setItem(key: string, value: string): Promise<void> {
    const storage = await this.getAsyncStorage()
    if (!storage) return

    try {
      await storage.setItem(key, value)
    } catch (error) {
      console.warn(`[Storage] Failed to set item "${key}":`, error)
    }
  }

  static async removeItem(key: string): Promise<void> {
    const storage = await this.getAsyncStorage()
    if (!storage) return

    try {
      await storage.removeItem(key)
    } catch (error) {
      console.warn(`[Storage] Failed to remove item "${key}":`, error)
    }
  }
}

// Specific key for color theme preference
export const COLOR_THEME_STORAGE_KEY = 'colorTheme'
