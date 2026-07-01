# Theme Switcher - Implementation Guide

## 🎯 Overview

The theme switcher allows users to choose between **Light**, **Dark**, and **System** theme preferences across web and native platforms. Theme preferences are synchronized across devices via the user's Supabase profile preferences.

## ✅ Current Status

### Web (Next.js)
- ✅ Fully functional with `next-themes`
- ✅ No flash of unstyled content (FOUC)
- ✅ SSR/SSG support
- ✅ LocalStorage persistence
- ✅ System theme detection
- ✅ Supabase profile cross-device sync

### Native (React Native / Expo)
- ✅ Full AsyncStorage persistence
- ✅ NativeWind integration
- ✅ System theme detection via Appearance API
- ✅ Supabase profile cross-device sync
- ✅ Automatic system theme changes tracking

## 📁 Key Files

### Core Implementation
```
packages/app/
├── hooks/
│   ├── useColorScheme.tsx        # Unified theme hook (web + native)
│   └── useThemeSync.ts            # Supabase profile sync hook
├── features/profile/components/
│   ├── ThemeSelector.tsx          # Native theme selector
│   └── ThemeSelector.web.tsx      # Web theme selector
└── provider/
    └── index.tsx                  # Global providers setup
```

### Localization
```
packages/app/locales/
├── en/messages.po                 # English translations
└── ms/messages.po                 # Malay translations
```

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    App Root Provider                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  useThemeSync()                                       │  │
│  │  - Loads theme from the Supabase profile on login     │  │
│  │  - Applies via useColorScheme.setThemeMode()          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                   useColorScheme Hook                       │
│  ┌─────────────────────┐        ┌──────────────────────┐   │
│  │      Web (Next)     │        │   Native (RN/Expo)   │   │
│  │                     │        │                      │   │
│  │  - next-themes      │        │  - NativeWind        │   │
│  │  - localStorage     │        │  - AsyncStorage      │   │
│  │  - prefers-color-   │        │  - Appearance API    │   │
│  │    scheme media     │        │                      │   │
│  └─────────────────────┘        └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    ThemeSelector Component                  │
│  - User interface for selecting theme                       │
│  - Saves selection to the Supabase profile (cross-device)   │
│  - Updates local theme via useColorScheme                   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### 1. **Initial Load (Login)**
```
User Logs In
    ↓
useThemeSync Hook (in Provider)
    ↓
Fetch theme from Supabase profile preferences (getUserPrefs)
    ↓
useColorScheme.setThemeMode(theme)
    ↓
┌──────────────────────────────────┬──────────────────────────────────┐
│              WEB                 │            NATIVE                │
│  next-themes.setTheme()          │  AsyncStorage.setItem()          │
│  document.html.classList         │  NativeWind.setColorScheme()     │
└──────────────────────────────────┴──────────────────────────────────┘
```

#### 2. **User Changes Theme**
```
User clicks theme button in ThemeSelector
    ↓
handleThemeChange(mode)
    ↓
┌────────────────────────────────────────────────────────────┐
│  1. Update local theme (immediate feedback)                │
│     - Web: next-themes.setTheme(mode)                      │
│     - Native: useColorScheme.setThemeMode(mode)            │
│                                                            │
│  2. Save to Supabase profile (for cross-device sync)      │
│     - updateUserPrefs({ theme: mode })                    │
└────────────────────────────────────────────────────────────┘
```

#### 3. **Cross-Device Sync**
```
Device A: User changes theme to "dark"
    ↓
ThemeSelector saves to the Supabase profile
    ↓
Device B: User opens app / refreshes page
    ↓
useThemeSync loads theme from the Supabase profile
    ↓
useColorScheme applies "dark" theme
    ↓
Device B shows dark theme ✅
```

## 🎨 Theme Modes

### 1. Light Mode
- Forces light theme regardless of system preference
- Persisted locally (localStorage/AsyncStorage)
- Synced via the Supabase profile

### 2. Dark Mode
- Forces dark theme regardless of system preference
- Persisted locally (localStorage/AsyncStorage)
- Synced via the Supabase profile

### 3. System Mode
- Follows OS/browser theme preference
- Automatically updates when system theme changes
- Web: Uses `prefers-color-scheme` media query
- Native: Uses React Native Appearance API
- Persisted as "system" preference
- Synced via the Supabase profile

## 🔌 API Reference

### `useColorScheme()` Hook

```typescript
interface UseColorSchemeReturn {
  // Current resolved color scheme
  colorScheme: 'dark' | 'light'
  isDarkColorScheme: boolean
  
  // Direct color scheme control (web/native specific)
  setColorScheme: (scheme: 'dark' | 'light') => void
  toggleColorScheme: () => void
  
  // Theme mode with system support
  themeMode: 'light' | 'dark' | 'system'
  setThemeMode: (mode: ThemeMode) => void
}
```

**Usage:**
```tsx
import { useColorScheme } from 'app/hooks/useColorScheme'

function MyComponent() {
  const { 
    themeMode,           // Current mode: 'light' | 'dark' | 'system'
    setThemeMode,        // Change theme mode
    isDarkColorScheme    // Is dark mode active?
  } = useColorScheme()
  
  // Change to dark mode
  setThemeMode('dark')
  
  // Change to system mode
  setThemeMode('system')
  
  // Conditional styling
  return (
    <View className={isDarkColorScheme ? 'bg-gray-900' : 'bg-white'}>
      <Text>Current theme: {themeMode}</Text>
    </View>
  )
}
```

### `useThemeSync()` Hook

```typescript
/**
 * Synchronizes theme from the Supabase profile on login
 * - Automatically called in app Provider
 * - Loads theme once per user session
 * - No manual intervention needed
 */
function useThemeSync(): void
```

**Usage:**
```tsx
// Already integrated in packages/app/provider/index.tsx
function Provider({ children }) {
  useThemeSync() // Automatically loads theme on login
  
  return <Providers>{children}</Providers>
}
```

## 🌍 Localization

Theme selector supports multiple languages via Lingui.

### English (`packages/app/locales/en/messages.po`)
```po
msgid "Theme"
msgstr "Theme"

msgid "Light"
msgstr "Light"

msgid "Dark"
msgstr "Dark"

msgid "System"
msgstr "System"
```

### Malay (`packages/app/locales/ms/messages.po`)
```po
msgid "Theme"
msgstr "Tema"

msgid "Light"
msgstr "Terang"

msgid "Dark"
msgstr "Gelap"

msgid "System"
msgstr "Sistem"
```

## 🧪 Testing

### Web Testing
1. Open browser DevTools
2. Go to Profile page
3. Click theme buttons (Light / Dark / System)
4. Verify:
   - Theme changes immediately
   - No page flash/flicker
   - Theme persists on refresh
5. Test system mode:
   - Go to OS settings → Change system theme
   - Browser should update automatically
6. Test cross-device:
   - Change theme on Device A
   - Open app on Device B
   - Verify theme matches

### Native Testing
1. Open Expo Go / Build app
2. Navigate to Profile screen
3. Tap theme buttons (Light / Dark / System)
4. Verify:
   - Theme changes immediately
   - UI updates correctly
   - Theme persists after app restart
5. Test system mode:
   - Go to device Settings → Display → Dark mode
   - Toggle dark mode on/off
   - App should update automatically
6. Test cross-device:
   - Change theme on Device A
   - Open app on Device B
   - Verify theme matches

## 🐛 Troubleshooting

### Web: Theme not changing
- Check browser console for errors
- Verify `next-themes` is installed
- Check `apps/next/app/layout.tsx` has `<ThemeProvider>`
- Clear localStorage: `localStorage.removeItem('theme')`

### Native: Theme not persisting
- Verify AsyncStorage is installed
- Check app permissions for storage
- Clear AsyncStorage: 
  ```tsx
  import AsyncStorage from '@react-native-async-storage/async-storage'
  await AsyncStorage.removeItem('theme-mode')
  ```

### Cross-device not syncing
- Verify user is logged in
- Check the Supabase profile preferences:
  ```tsx
  import { getUserPrefs } from 'app/lib/prefs'
  const prefs = await getUserPrefs()
  console.log(prefs.theme)
  ```
- Ensure `useThemeSync()` is called in Provider

### System mode not working
- **Web**: Check browser supports `prefers-color-scheme`
- **Native**: Test on physical device (some emulators don't support)

## 📦 Dependencies

### Web
- `next-themes` - Theme management for Next.js
- `tailwindcss` - Styling with dark mode support

### Native
- `nativewind` - Tailwind CSS for React Native
- `@react-native-async-storage/async-storage` - Local persistence
- `react-native` - Appearance API for system theme

### Shared
- `@lingui/react` - Internationalization
- `@supabase/supabase-js` - Cross-device preference sync (profile `prefs`)

## 🚀 Future Enhancements

### Potential Improvements
- [ ] Theme preview before applying
- [ ] Custom theme colors (user-defined)
- [ ] Schedule theme changes (e.g., dark at night)
- [ ] Per-screen theme overrides
- [ ] Theme analytics (most popular theme)

### Performance Optimizations
- [x] Lazy load next-themes on web
- [x] Memoize theme context values
- [x] Debounce Supabase profile save operations
- [x] Cache theme in memory

## 📝 Notes

### Design Decisions

1. **Separate Web/Native Components**
   - `ThemeSelector.web.tsx` uses `next-themes` directly
   - `ThemeSelector.tsx` uses `useColorScheme` hook
   - Reason: Better bundle size, platform-specific optimizations

2. **Two-Level Loading**
   - `useThemeSync` loads at app root
   - `ThemeSelector` loads on component mount
   - Reason: Ensures theme is correct even if user navigates directly to profile

3. **Emojis vs Icons**
   - Using emojis (☀️ 🌙 💻) instead of Heroicons
   - Reason: Better cross-platform consistency, no extra dependencies

4. **AsyncStorage vs Context**
   - Native uses AsyncStorage directly
   - No separate context provider needed
   - Reason: Simpler architecture, less complexity

### Breaking Changes History

- **v1.0**: Initial implementation with basic light/dark toggle
- **v2.0**: Added system theme support
- **v3.0**: Added Supabase profile cross-device sync
- **v3.1**: Refactored to use unified `useColorScheme` hook
- **v3.2**: Removed ThemeContext, simplified architecture

## ✅ Checklist for New Developers

When working with themes, ensure:
- [ ] Using `useColorScheme()` hook for theme access
- [ ] Not creating separate theme state
- [ ] Using Tailwind's `dark:` prefix for conditional styling
- [ ] Testing both light and dark modes
- [ ] Testing system mode with OS theme changes
- [ ] Verifying cross-device sync with multiple devices
- [ ] Adding Lingui translations for new UI text
- [ ] Following existing console.log conventions for debugging

## 🎉 Success Metrics

The theme switcher is considered fully functional when:
- ✅ User can switch between 3 modes (light/dark/system)
- ✅ Theme persists across app restarts
- ✅ Theme syncs across devices via the Supabase profile
- ✅ System mode follows OS theme changes
- ✅ No visual flicker on load
- ✅ Works on both web and native
- ✅ All UI text is translated
- ✅ Proper loading states shown

---

**Last Updated:** November 17, 2025  
**Version:** 3.2  
**Status:** ✅ Production Ready

