# Theme Synchronization Across Devices Fix

## Issue

Theme changes made on one device were not reflected on other devices until the user navigated to the profile page or refreshed the profile page. This was because the theme was only loaded from the user's Supabase profile preferences when the `ThemeSelector` component mounted (which only happens on the profile page).

## Root Cause

The theme synchronization logic was implemented only in the `ThemeSelector` component:

```typescript
// In ThemeSelector.web.tsx
useEffect(() => {
  const loadThemeFromProfile = async () => {
    if (!user) return
    
    try {
      const prefs = await getUserPrefs()
      const savedTheme = (prefs as any)?.theme as ThemeMode
      if (savedTheme && savedTheme !== currentThemeMode) {
        setTheme(savedTheme)
      }
    } catch (e) {
      console.error('Failed to load theme from the Supabase profile:', e)
    }
  }
  
  loadThemeFromProfile()
}, [user])
```

This meant that:
1. Theme was only loaded when visiting the profile page
2. Other pages/devices didn't automatically sync the theme
3. User had to manually visit profile page to see theme changes

## Solution

Created a global theme synchronization mechanism similar to how language preferences are handled:

### 1. Created `useThemeSync` Hook

**File**: `packages/app/hooks/useThemeSync.ts`

This hook:
- Loads theme from the Supabase profile when user logs in
- Only loads once per user session to avoid unnecessary API calls
- Applies the theme if it differs from the current local theme
- Resets when user logs out

```typescript
export function useThemeSync() {
  const { user, isLoading } = useAuth()
  const { setThemeMode, themeMode } = useColorScheme()
  const hasLoadedForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (isLoading || !user) return
    if (hasLoadedForUserRef.current === user.id) return

    const syncThemeFromProfile = async () => {
      try {
        const prefs = await getUserPrefs()
        const savedTheme = (prefs as any)?.theme as ThemeMode

        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          if (savedTheme !== themeMode) {
            console.log('[useThemeSync] Applying theme from Supabase profile:', savedTheme)
            setThemeMode(savedTheme)
          }
        }
        
        hasLoadedForUserRef.current = user.id
      } catch (error) {
        console.error('[useThemeSync] Failed to sync theme from Supabase profile:', error)
        hasLoadedForUserRef.current = user.id
      }
    }

    syncThemeFromProfile()
  }, [user, isLoading, setThemeMode, themeMode])

  useEffect(() => {
    if (!user) {
      hasLoadedForUserRef.current = null
    }
  }, [user])
}
```

### 2. Integrated into App Provider

**File**: `packages/app/provider/index.tsx`

Added the `useThemeSync` hook to the `I18nProviderWrapper` component, which is called at the app root level:

```typescript
function I18nProviderWrapper({ children }: { children: React.ReactNode }) {
  const [isI18nLoaded, setIsI18nLoaded] = useState(Platform.OS !== 'web')
  const { user, isLoading } = useAuth()

  useOAuthCallback()
  
  // Sync theme from the Supabase profile when user logs in
  useThemeSync()  // <-- Added this line

  // ... rest of the component
}
```

## How It Works

### Flow Diagram

```
User logs in on Device A
    ↓
Changes theme to "dark"
    ↓
ThemeSelector saves to the Supabase profile preferences
    ↓
User opens app on Device B
    ↓
AuthProvider loads user
    ↓
useThemeSync hook detects user is logged in
    ↓
Fetches theme preference from the Supabase profile
    ↓
Applies "dark" theme to Device B
    ↓
User sees correct theme immediately
```

### Key Features

1. **Automatic Synchronization**: Theme is loaded automatically when user logs in
2. **One-Time Load**: Only fetches from the Supabase profile once per user session to avoid unnecessary API calls
3. **Cross-Platform**: Works on both web (Next.js) and native (React Native/Expo)
4. **Non-Intrusive**: Doesn't interfere with local theme changes
5. **Efficient**: Uses user ID to track whether theme has been loaded for current user

## Testing

### Test Scenario 1: Theme Change Across Devices

1. Open app on Device A
2. Log in
3. Go to Profile → Change theme to "Dark"
4. Open app on Device B with same account
5. ✅ Theme should be "Dark" immediately on load

### Test Scenario 2: Theme Change Without Profile Visit

1. Open app on Device A
2. Log in
3. Change theme to "Light" on profile page
4. Open app on Device B with same account
5. Navigate to Home, Search, or any other page (NOT profile)
6. ✅ Theme should be "Light" without visiting profile page

### Test Scenario 3: Local Theme Preference

1. Open app on Device A
2. Log in (theme loads from the Supabase profile)
3. Change theme locally (without saving to the Supabase profile)
4. Navigate to different pages
5. ✅ Local theme change should persist during session
6. ✅ Should not be overridden by the Supabase profile theme

## Files Changed

1. **Created**: `packages/app/hooks/useThemeSync.ts`
   - New hook for theme synchronization

2. **Modified**: `packages/app/provider/index.tsx`
   - Added `useThemeSync` import
   - Called `useThemeSync()` in `I18nProviderWrapper`

## Benefits

1. **Better UX**: Users see their theme preference immediately across all devices
2. **Consistent with Language Sync**: Uses the same pattern as language preference synchronization
3. **Minimal Performance Impact**: Only loads once per user session
4. **No Breaking Changes**: Existing theme functionality continues to work as before

## Future Enhancements

Potential improvements for future iterations:

1. **Real-time Sync**: Use Supabase Realtime to sync theme changes instantly across devices
2. **Conflict Resolution**: Handle cases where user changes theme on multiple devices simultaneously
3. **Offline Support**: Cache theme preference for offline access
4. **Theme History**: Track theme change history for analytics

## Related Documentation

- [Theme Switcher Implementation](../features/theme-switcher/IMPLEMENTATION.md)
- [Theme Switcher Quick Start](../features/theme-switcher/QUICK_START.md)
- [useColorScheme Hook](../../packages/app/hooks/useColorScheme.tsx)

