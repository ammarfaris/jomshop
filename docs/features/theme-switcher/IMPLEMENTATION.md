# Theme Switcher Implementation

## Overview

This document describes the implementation of the theme switcher feature that allows users to choose between light mode, dark mode, or system preference for the application's appearance.

## Features

- **Three Theme Modes**:
  - 🌞 **Light Mode**: Forces light theme regardless of system preference
  - 🌙 **Dark Mode**: Forces dark theme regardless of system preference
  - 💻 **System Mode**: Automatically follows the operating system's theme preference

- **Cross-Platform Support**: Works seamlessly on web (Next.js) and native (React Native/Expo)
- **Persistent Preferences**: Theme choice is saved and synced across devices via Appwrite
- **Smooth Transitions**: No flash of unstyled content on page load
- **Real-time Updates**: Automatically responds to system theme changes when in system mode

## Architecture

### Components

1. **`useColorScheme` Hook** (`packages/app/hooks/useColorScheme.tsx`)
   - Unified interface for theme management across platforms
   - Returns current theme state and control functions
   - Handles platform-specific implementations

2. **`ThemeSelector` Component** (`packages/app/features/profile/components/ThemeSelector.tsx`)
   - User interface for theme selection
   - Three visual buttons for light/dark/system modes
   - Syncs theme preference with Appwrite user preferences
   - Supports localization (English/Malay)

3. **Icon Components**:
   - `SunIcon`: Represents light mode
   - `MoonIcon`: Represents dark mode
   - `ComputerDesktopIcon`: Represents system mode

## Platform-Specific Implementation

### Web (Next.js)

The web implementation leverages `next-themes` library:

```typescript
// Configured in apps/next/app/layout.tsx
<ThemeProvider
  attribute="class"        // Uses class-based dark mode
  defaultTheme="system"    // Default to system preference
  enableSystem             // Enable system theme detection
  disableTransitionOnChange
>
```

**Features**:
- Uses `localStorage` for persistence
- Supports SSR/SSG without theme flash
- Automatically syncs with system theme changes
- Works with Tailwind CSS `dark:` variant

### Native (React Native/Expo)

The native implementation uses NativeWind with React Native's Appearance API:

**Features**:
- Uses `AsyncStorage` for persistence
- Listens to `Appearance.addChangeListener` for system theme changes
- Automatically applies theme when OS theme changes
- Seamlessly integrates with NativeWind

## Storage & Persistence

Theme preferences are stored in three locations:

1. **Local Storage** (Platform-specific):
   - **Web**: `localStorage` (via next-themes)
   - **Native**: `AsyncStorage`
   - Purpose: Fast local access, works offline

2. **Appwrite User Preferences**:
   - Stored in user's preferences document
   - Enables cross-device synchronization
   - Key: `theme` with value `'light' | 'dark' | 'system'`

## Usage

### Basic Usage

```typescript
import { useColorScheme } from 'app/hooks/useColorScheme'

function MyComponent() {
  const { 
    colorScheme,        // 'light' | 'dark' - The resolved color scheme
    isDarkColorScheme,  // boolean - True if dark mode is active
    themeMode,          // 'light' | 'dark' | 'system' - Current theme mode
    setThemeMode,       // Function to change theme mode
  } = useColorScheme()

  // Change to dark mode
  const handleDarkMode = () => {
    setThemeMode('dark')
  }

  // Follow system preference
  const handleSystemMode = () => {
    setThemeMode('system')
  }

  return (
    <View className={isDarkColorScheme ? 'bg-gray-900' : 'bg-white'}>
      <Text>Current theme: {themeMode}</Text>
      <Button onPress={handleDarkMode}>Dark Mode</Button>
      <Button onPress={handleSystemMode}>System Mode</Button>
    </View>
  )
}
```

### Using the ThemeSelector Component

```typescript
import { ThemeSelector } from 'app/features/profile/components/ThemeSelector'

function ProfileScreen() {
  return (
    <View>
      <ThemeSelector />
    </View>
  )
}
```

## Styling with Themes

### Using Tailwind CSS Dark Mode

```typescript
// Light mode: bg-white, Dark mode: bg-gray-900
<View className="bg-white dark:bg-gray-900">
  <Text className="text-gray-900 dark:text-gray-100">
    This text adapts to the theme
  </Text>
</View>
```

### Conditional Styling

```typescript
const { isDarkColorScheme } = useColorScheme()

<View style={{
  backgroundColor: isDarkColorScheme ? '#1a1a1a' : '#ffffff'
}}>
  {/* Content */}
</View>
```

## API Reference

### `useColorScheme()` Hook

**Returns:**

```typescript
interface UseColorSchemeReturn {
  // The actual resolved color scheme being displayed
  colorScheme: 'dark' | 'light'
  
  // Boolean indicating if dark mode is active
  isDarkColorScheme: boolean
  
  // Set a specific color scheme (bypasses theme mode)
  setColorScheme: (scheme: 'dark' | 'light') => void
  
  // Toggle between light and dark
  toggleColorScheme: () => void
  
  // Current theme mode setting
  themeMode: 'light' | 'dark' | 'system'
  
  // Change the theme mode
  setThemeMode: (mode: ThemeMode) => void
}
```

### `ThemeSelector` Component

**Props:** None (standalone component)

**Features:**
- Displays three theme option buttons
- Shows current selection
- Syncs with Appwrite user preferences
- Loading states during theme changes
- Localized labels

## Localization

Theme-related text is localized in both English and Malay:

| English | Malay |
|---------|-------|
| Theme   | Tema  |
| Light   | Cahaya|
| Dark    | Gelap |
| System  | Sistem|

Translations are stored in:
- `packages/app/locales/en/messages.po`
- `packages/app/locales/ms/messages.po`

## Testing

### Manual Testing Checklist

#### Web Testing:
- [ ] Change theme to Light - should show light colors immediately
- [ ] Change theme to Dark - should show dark colors immediately
- [ ] Change theme to System - should match OS theme
- [ ] Change OS theme while app is in System mode - should update automatically
- [ ] Refresh page - theme preference should persist
- [ ] Log out and log back in - theme should be restored from Appwrite

#### Native Testing:
- [ ] Change theme to Light - should show light colors immediately
- [ ] Change theme to Dark - should show dark colors immediately
- [ ] Change theme to System - should match OS theme
- [ ] Change OS theme while app is in System mode - should update automatically
- [ ] Kill and restart app - theme preference should persist
- [ ] Log out and log back in - theme should be restored from Appwrite

#### Cross-Device Testing:
- [ ] Set theme on Device A
- [ ] Log in on Device B - should show same theme
- [ ] Change theme on Device B
- [ ] Return to Device A and refresh - should show updated theme

## Troubleshooting

### Theme doesn't persist after refresh

**Solution**: Check that:
1. `next-themes` is properly configured in `apps/next/app/layout.tsx`
2. AsyncStorage is working on native (check permissions)
3. Appwrite user preferences are being saved

### System mode not working

**Web Solution**:
- Ensure `enableSystem` prop is set in `ThemeProvider`
- Check browser supports `prefers-color-scheme` media query

**Native Solution**:
- Ensure `Appearance` API is imported from `react-native`
- Check that event listener is properly attached

### Flash of unstyled content on web

**Solution**:
- Ensure `suppressHydrationWarning` is set on `<html>` tag
- Verify `next-themes` is properly configured
- Check that Tailwind config has `darkMode: 'class'`

## Files Modified/Created

### Modified Files:
- `packages/app/hooks/useColorScheme.tsx` - Enhanced with system mode support
- `packages/app/features/profile/screen.tsx` - Added ThemeSelector component
- `packages/app/locales/ms/messages.po` - Added theme translations

### Created Files:
- `packages/app/features/profile/components/ThemeSelector.tsx`
- `packages/app/components/icons-svg/SunIcon.tsx`
- `packages/app/components/icons-svg/MoonIcon.tsx`
- `packages/app/components/icons-svg/ComputerDesktopIcon.tsx`
- `docs/features/theme-switcher/IMPLEMENTATION.md` (this file)

## Future Enhancements

Potential improvements for future iterations:

1. **High Contrast Mode**: Add a fourth option for high contrast themes
2. **Custom Theme Colors**: Allow users to customize theme colors
3. **Scheduled Themes**: Auto-switch based on time of day
4. **Per-Screen Themes**: Different themes for different parts of the app
5. **Theme Animations**: Smooth animated transitions between themes
6. **Color Temperature**: Adjust color temperature for night mode

## References

- [NativeWind Documentation](https://www.nativewind.dev/)
- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [React Native Appearance API](https://reactnative.dev/docs/appearance)

