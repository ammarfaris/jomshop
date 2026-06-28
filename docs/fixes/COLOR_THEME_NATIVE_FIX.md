# Color Theme Not Working on Native (iOS/Android) - Fixed ✅

## 🐛 The Problem

When switching between Green and Blue color themes on **iOS/Android native apps**, only some elements (like the "Bigger" text in TextScaleSelector) would change color. Most elements in the profile General tab (language selection, theme boxes, etc.) remained gray instead of showing the selected theme color.

However, on **Web**, all elements correctly displayed the theme colors.

## 🔍 Root Cause

The issue was caused by **NativeWind v4's limitations with CSS variables on native platforms**:

### How It Works on Web ✅
1. CSS variables are defined in `apps/next/app/globals.css`:
   ```css
   :root.theme-green {
     --main: 142.1 76.2% 36.3%;
   }
   :root.theme-blue {
     --main: 217.2 91.2% 59.8%;
   }
   ```
2. The `ColorThemeContext` adds/removes classes on `document.documentElement`
3. Tailwind classes like `border-main`, `bg-main/10`, `text-main` reference these CSS variables
4. When the theme changes, the CSS variables update immediately

### Why It Fails on Native ❌
1. React Native has **no DOM** - there's no `document.documentElement` to manipulate
2. NativeWind compiles Tailwind classes at **build time**, not runtime
3. CSS variables (`--main`) are baked into the compiled styles with the **default (green) values**
4. When you change themes, the CSS variables **don't update** because there's no way to dynamically modify them
5. Result: `border-main` stays green even when you select blue theme

## ✅ The Solution

Use **platform-specific conditional styling**:

### For Web
Continue using CSS variable-based classes:
- `border-main bg-main/10`
- `text-main`

### For Native
Use **hardcoded Tailwind color classes** based on the active `colorTheme`:
- Green theme: `border-green-600 bg-green-600/10`, `text-green-600`
- Blue theme: `border-blue-500 bg-blue-500/10`, `text-blue-500`

## 📝 Implementation

### 1. Import ColorTheme Context

```typescript
import { useColorTheme } from 'app/contexts/ColorThemeContext'
```

### 2. Create Helper Functions

```typescript
function MyComponent() {
  const { colorTheme } = useColorTheme()
  
  // Helper for border/background colors
  const getActiveBorderClass = () => {
    if (Platform.OS === 'web') {
      return 'border-main bg-main/10'
    }
    // On native, use hardcoded colors based on active theme
    return colorTheme === 'blue'
      ? 'border-blue-500 bg-blue-500/10'
      : 'border-green-600 bg-green-600/10'
  }
  
  // Helper for text colors
  const getActiveTextClass = () => {
    if (Platform.OS === 'web') {
      return 'text-main'
    }
    return colorTheme === 'blue' ? 'text-blue-500' : 'text-green-600'
  }
  
  // Use in JSX
  return (
    <Pressable
      className={cn(
        'border-2',
        isActive ? getActiveBorderClass() : 'border-gray-300'
      )}
    >
      <Text className={cn(isActive ? getActiveTextClass() : 'text-gray-600')}>
        Option
      </Text>
    </Pressable>
  )
}
```

## 📁 Files Changed

### 1. Profile General Tab
**File**: `packages/app/features/profile/screen.tsx`

- Added `useColorTheme` import
- Added `getActiveBorderClass()` and `getActiveTextClass()` helpers to `GeneralTabContent`
- Updated language toggle Pressables to use helper functions
- Updated Sign Out button to use platform-aware background color

**Before**:
```typescript
className={cn(
  'border-2',
  currentLocale === 'en' 
    ? 'border-main bg-main/10'  // Doesn't work on native!
    : 'border-gray-300'
)}
```

**After**:
```typescript
className={cn(
  'border-2',
  currentLocale === 'en' 
    ? getActiveBorderClass()  // Platform-aware!
    : 'border-gray-300'
)}
```

### 2. Color Theme Selector
**File**: `packages/app/features/profile/components/ColorThemeSelector.tsx`

- Added `Platform` import
- Added `getActiveBorderClass(theme)` and `getActiveTextClass(theme)` helpers
- Note: These helpers accept a `theme` parameter to support rendering both green and blue options
- Updated all theme option Pressables to use helper functions

### 3. Text Scale Selector
**File**: `packages/app/features/profile/components/TextScaleSelector.tsx`

- Added `useColorTheme` import
- Added `getActiveBorderClass()` helper function
- Updated Pressable border/background to use helper function
- Note: Text colors were already working correctly using inline styles with `useColorThemeValues`

**Before**:
```typescript
className={cn(
  'border-2',
  isCurrentScale 
    ? 'border-main bg-main/10'  // Doesn't work on native!
    : 'border-gray-300'
)}
```

**After**:
```typescript
className={cn(
  'border-2',
  isCurrentScale 
    ? getActiveBorderClass()  // Platform-aware!
    : 'border-gray-300'
)}
```

### 4. Receipt Thumbnail
**File**: `packages/app/features/profile/components/ReceiptThumbnail.tsx`

- Added `useColorTheme` import
- Added `getEditButtonClass()` helper function
- Updated edit button background to use helper function

**Before**:
```typescript
<Pressable className="bg-main rounded-full p-2">
  {/* Edit icon */}
</Pressable>
```

**After**:
```typescript
<Pressable className={cn(getEditButtonClass(), 'rounded-full p-2')}>
  {/* Edit icon */}
</Pressable>
```

## 🎨 Color Values Used

### Green Theme (Default)
- Light mode: `hsl(142.1, 76.2%, 36.3%)` → Tailwind: `green-600`
- Border: `border-green-600`
- Background: `bg-green-600/10`
- Text: `text-green-600`

### Blue Theme
- Light mode: `hsl(217.2, 91.2%, 59.8%)` → Tailwind: `blue-500`
- Border: `border-blue-500`
- Background: `bg-blue-500/10`
- Text: `text-blue-500`

## ⚙️ How It Works

1. **On Web**:
   - `Platform.OS === 'web'` returns `true`
   - Functions return CSS variable classes: `'border-main bg-main/10'`
   - CSS variables update when theme class changes on document root
   - Everything works as before

2. **On Native (iOS/Android)**:
   - `Platform.OS === 'web'` returns `false`
   - Functions return hardcoded Tailwind color classes
   - Classes change based on `colorTheme` from context
   - NativeWind compiles these to the correct colors at build time
   - When theme changes, components re-render with new classes

## 🧪 Testing

### Test on iOS Simulator
1. Open profile page → General tab
2. Switch to Blue theme
3. ✅ Verify: Theme selector borders and text turn blue
4. ✅ Verify: Selected language box borders and text turn blue
5. Switch to Green theme
6. ✅ Verify: All elements turn green

### Test on Android Emulator
Same steps as iOS

### Test on Web
1. Open profile page → General tab
2. Switch between themes
3. ✅ Verify: All elements still work correctly (using CSS variables)

## 🔄 Related Components

The following components already handle native color theming correctly:

### ✅ TextScaleSelector
**File**: `packages/app/features/profile/components/TextScaleSelector.tsx`

Uses `useColorThemeValues` hook with inline styles:
```typescript
const themeColors = useColorThemeValues(isDarkColorScheme)
style={Platform.OS === 'web' ? undefined : {
  color: themeColors.main  // Inline style for native
}}
```

This works for **text colors** but not for borders/backgrounds, which is why we use conditional class names instead.

## 📚 Alternative Approaches Considered

### ❌ Approach 1: Use useColorThemeValues with Inline Styles
**Problem**: React Native doesn't support `borderColor` or `backgroundColor` with opacity in inline styles the way we need them (e.g., `bg-main/10`)

### ❌ Approach 2: Create Dynamic Tailwind Classes
**Problem**: NativeWind compiles at build time, can't generate classes dynamically at runtime

### ✅ Approach 3: Conditional Class Names (CHOSEN)
**Why**: Simple, performant, leverages existing Tailwind classes that NativeWind already compiles

## 🚀 Future Improvements

1. **Create a Custom Hook**: Extract `getActiveBorderClass` and `getActiveTextClass` into a reusable hook:
   ```typescript
   // packages/app/hooks/useColorThemeClasses.ts
   export function useColorThemeClasses() {
     const { colorTheme } = useColorTheme()
     // ... return helpers
   }
   ```

2. **Update All Components**: Audit the entire codebase for other components using `border-main`, `bg-main`, `text-main` and update them

3. **Documentation**: Update `COLOR_THEME_IMPLEMENTATION.md` with native-specific guidance

## 🐞 Known Limitations

1. **Dark Mode Colors**: The current implementation uses the same Tailwind colors (`green-600`, `blue-500`) in both light and dark modes. The CSS variable approach on web supports different colors for dark mode. If needed, we can enhance the helper functions to check `isDarkColorScheme`.

2. **Additional Themes**: If more themes are added (purple, orange, etc.), the helper functions need to be updated with new color mappings.

## 📖 References

- NativeWind v4 Documentation: https://www.nativewind.dev/
- React Native Styling Limitations: https://reactnative.dev/docs/style
- Original Color Theme Implementation: `docs/features/color-theme/COLOR_THEME_IMPLEMENTATION.md`

---

**Fixed by**: Assistant  
**Date**: 2025-11-17  
**Issue**: Color theme not working on native platforms  
**Status**: ✅ Fixed and tested

