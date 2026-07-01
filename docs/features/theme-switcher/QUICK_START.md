# Theme Switcher - Quick Start Guide

## TL;DR

Theme switcher is now available in the Profile screen! Users can choose between Light, Dark, or System theme modes. The preference syncs across devices via the user's Supabase profile.

## For Users

1. Navigate to **Profile** tab
2. Under **General** settings, find the **Theme** section
3. Choose your preferred theme:
   - ☀️ **Light** - Always use light mode
   - 🌙 **Dark** - Always use dark mode  
   - 💻 **System** - Follow your device's theme

Your selection is saved automatically and syncs across all your devices!

## For Developers

### Quick Implementation

Want to add theme-aware styling to your component?

```typescript
import { useColorScheme } from 'app/hooks/useColorScheme'

function MyComponent() {
  const { isDarkColorScheme, themeMode } = useColorScheme()
  
  return (
    <View className="bg-white dark:bg-gray-900">
      <Text>Current mode: {themeMode}</Text>
      <Text className="text-gray-900 dark:text-white">
        This text adapts to the theme
      </Text>
    </View>
  )
}
```

### Adding Theme Switcher to Another Screen

```typescript
import { ThemeSelector } from 'app/features/profile/components/ThemeSelector'

function SettingsScreen() {
  return (
    <View>
      <Text className="font-bold mb-2">Appearance</Text>
      <ThemeSelector />
    </View>
  )
}
```

### Programmatically Change Theme

```typescript
import { useColorScheme } from 'app/hooks/useColorScheme'

function MyComponent() {
  const { setThemeMode } = useColorScheme()
  
  return (
    <>
      <Button onPress={() => setThemeMode('dark')}>
        Go Dark
      </Button>
      <Button onPress={() => setThemeMode('light')}>
        Go Light
      </Button>
      <Button onPress={() => setThemeMode('system')}>
        Use System
      </Button>
    </>
  )
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     useColorScheme Hook                      │
│  Unified API for theme management across web and native     │
└──────────────────┬───────────────────┬──────────────────────┘
                   │                   │
         ┌─────────▼────────┐  ┌──────▼──────────┐
         │   WEB (Next.js)  │  │  NATIVE (Expo)  │
         │   - next-themes  │  │  - NativeWind   │
         │   - localStorage │  │  - AsyncStorage │
         └─────────┬────────┘  └──────┬──────────┘
                   │                   │
                   └──────────┬────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Supabase Profile   │
                   │  (Cross-device sync)│
                   └─────────────────────┘
```

## Key Features

✅ Three modes: Light, Dark, System
✅ Works on web and native
✅ Persists across sessions
✅ Syncs across devices (Supabase profile)
✅ Auto-updates when system theme changes
✅ Localized (English & Malay)
✅ No flash of unstyled content
✅ TypeScript support

## Common Patterns

### Conditional Rendering

```typescript
const { isDarkColorScheme } = useColorScheme()

return isDarkColorScheme ? <DarkLogo /> : <LightLogo />
```

### Style Objects

```typescript
const { isDarkColorScheme } = useColorScheme()

<View style={{
  backgroundColor: isDarkColorScheme ? '#000' : '#fff',
  borderColor: isDarkColorScheme ? '#333' : '#ddd',
}}>
```

### Tailwind Classes

```typescript
<View className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
  <Text className="text-gray-900 dark:text-gray-100">
    Content
  </Text>
</View>
```

### Icons with Theme

```typescript
const { isDarkColorScheme } = useColorScheme()

<Icon color={isDarkColorScheme ? '#fff' : '#000'} />
```

## Testing Your Component

```typescript
// Test in different themes
function TestComponent() {
  const { setThemeMode, themeMode } = useColorScheme()
  
  return (
    <View>
      {/* Your component to test */}
      <MyComponent />
      
      {/* Quick theme switcher for testing */}
      <View className="flex-row gap-2 mt-4">
        <Button onPress={() => setThemeMode('light')}>Light</Button>
        <Button onPress={() => setThemeMode('dark')}>Dark</Button>
        <Button onPress={() => setThemeMode('system')}>System</Button>
      </View>
      <Text>Current: {themeMode}</Text>
    </View>
  )
}
```

## Need More Info?

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for detailed documentation.

## Troubleshooting

**Theme not changing?**
- Check that your component uses `useColorScheme` hook
- Verify Tailwind classes use `dark:` prefix
- Ensure parent component doesn't override styles

**Theme not persisting?**
- Check AsyncStorage permissions (native)
- Verify localStorage is enabled (web)
- Ensure user is logged in for Supabase profile sync

**System mode not working?**
- Check device/OS supports dark mode
- Verify app has permission to read system settings
- Test by changing device theme manually

