# Purple Theme Addition & Markdown Badge Theme Colors

## Overview

This document describes the changes made to add a new purple color theme and update the markdown-related UI elements in the admin contest forms to use theme colors instead of hardcoded purple.

## Changes Made

### 1. Added Purple Theme Color

A new purple theme color was added to the color theme system, giving users three theme options:
- 🟢 **Green** (Default) - Fresh & Natural
- 🔵 **Blue** - Cool & Professional  
- 🟣 **Purple** (New) - Creative & Vibrant

#### Color Values

**Light Mode:**
- Main: `hsl(270, 91%, 65%)`
- Main Foreground: `hsl(355.7, 100%, 97.3%)`

**Dark Mode:**
- Main: `hsl(270, 91%, 65%)`
- Main Foreground: `hsl(270, 100%, 95%)`

### 2. Updated Markdown UI Elements to Use Theme Colors

The markdown tip boxes and "Markdown" badges in `CreateContestTabContent.tsx` and `EditContestTabContent.tsx` now use the current theme color instead of hardcoded purple colors.

**Before:**
- Hardcoded purple colors: `bg-purple-100`, `text-purple-700`, etc.

**After:**
- Theme-aware colors: `bg-main/10`, `text-main`, `border-main/30`, etc.
- On web: Uses CSS variables that adapt to the selected theme
- On native: Uses the current theme color from `useColorThemeValues`

## Files Modified

### Core Theme Files

1. **`apps/next/app/globals.css`**
   - Added `:root.theme-purple` section for light mode
   - Added `.dark:root.theme-purple` section for dark mode
   - **Fixed CSS specificity issue:** Separated `:root` (default) from `:root.theme-green` to prevent conflicts with purple theme

2. **`apps/expo/global.css`**
   - Added `:root.theme-purple` section for light mode
   - Added `.dark:root.theme-purple` section for dark mode
   - **Fixed CSS specificity issue:** Separated `:root` (default) from `:root.theme-green` to prevent conflicts with purple theme

3. **`packages/app/contexts/ColorThemeContext.tsx`**
   - Updated `ColorTheme` type to include `'purple'`
   - Updated theme validation to accept `'purple'` as a valid theme
   - Updated initialization and loading logic to support purple theme

4. **`packages/app/hooks/useColorThemeValues.ts`**
   - Added purple theme color values to `COLOR_THEMES` object
   - Includes both light and dark mode values

5. **`packages/app/features/profile/components/ColorThemeSelector.tsx`**
   - Added purple theme option to the theme selector UI
   - Updated helper functions to handle purple theme styling
   - Added 🟣 emoji and "Creative & Vibrant" description

6. **`apps/next/app/layout.tsx`**
   - **Fixed flash on refresh:** Updated blocking script to include 'purple' in theme checks
   - Updated classList operations to remove 'theme-purple' when switching themes

### Admin Contest Forms

7. **`packages/app/features/admin/CreateContestTabContent.tsx`**
   - Updated "Markdown" badges to use theme colors
   - Updated markdown tip box to use theme colors
   - Added proper styling for both web and native platforms

8. **`packages/app/features/admin/EditContestTabContent.tsx`**
   - Updated "Markdown" badges to use theme colors
   - Updated markdown tip box to use theme colors
   - Added proper styling for both web and native platforms

### Profile Screen Components

9. **`packages/app/features/profile/components/GeneralTabContent.tsx`**
   - Updated helper functions to support purple theme on native
   - Fixed language selector border and text colors for purple theme

10. **`packages/app/features/profile/components/TextScaleSelector.tsx`**
    - Updated helper function to support purple theme on native
    - Fixed text size selector border colors for purple theme

## Implementation Details

### Markdown Badge Styling

The "Markdown" badges now use:
- **Web:** Tailwind classes with CSS variables (`bg-main/10`, `border-main/30`, `text-main`)
- **Native:** Inline styles with rgba colors for the purple fallback, plus dynamic color from `useColorThemeValues`

```tsx
<Badge
  variant="outline"
  style={
    Platform.OS === 'web'
      ? undefined
      : {
          backgroundColor: isDarkColorScheme
            ? 'rgba(128, 90, 213, 0.2)'
            : 'rgba(128, 90, 213, 0.1)',
          borderColor: isDarkColorScheme
            ? 'rgba(128, 90, 213, 0.4)'
            : 'rgba(128, 90, 213, 0.3)',
        }
  }
  className="bg-main/10 border-main/30 dark:bg-main/20 dark:border-main/40"
>
  <Text
    className="text-xs font-medium text-main dark:text-main"
    style={Platform.OS === 'web' ? undefined : { color: main }}
  >
    Markdown
  </Text>
</Badge>
```

### Markdown Tip Box Styling

The tip boxes now use:
- **Web:** Tailwind classes with CSS variables (`bg-main/5`, `border-main/20`, `text-main`)
- **Native:** Inline styles with rgba colors for the purple fallback, plus dynamic color from `useColorThemeValues`

```tsx
<View
  className="mt-2 mb-4 px-3 py-2 bg-main/5 dark:bg-main/10 rounded-md border border-main/20 dark:border-main/30"
  style={
    Platform.OS === 'web'
      ? undefined
      : {
          backgroundColor: isDarkColorScheme
            ? 'rgba(128, 90, 213, 0.1)'
            : 'rgba(128, 90, 213, 0.05)',
          borderColor: isDarkColorScheme
            ? 'rgba(128, 90, 213, 0.3)'
            : 'rgba(128, 90, 213, 0.2)',
        }
  }
>
  <Text
    className="text-xs text-main dark:text-main"
    style={Platform.OS === 'web' ? undefined : { color: main }}
  >
    💡 Tip: Fields marked with "Markdown" badge support markdown
    formatting: **bold text**, [Link Text](https://example.com), or
    [Internal Link](/page)
  </Text>
</View>
```

## Benefits

1. **Consistent Theme System:** The markdown UI elements now respect the user's chosen theme color
2. **New Purple Theme:** Users have a third color option that's vibrant and creative
3. **Better UX:** Admin users see consistent colors throughout the form based on their theme preference
4. **Cross-Platform:** Works seamlessly on both web and native platforms

## Testing Recommendations

1. **Theme Switching:**
   - Switch between green, blue, and purple themes in profile settings
   - Verify all interactive elements update correctly

2. **Admin Forms:**
   - Open Create Contest form
   - Open Edit Contest form
   - Verify markdown badges and tip boxes match the selected theme
   - Test in both light and dark modes

3. **Cross-Platform:**
   - Test on web (Next.js)
   - Test on native (Expo/React Native)
   - Verify colors render correctly on both platforms

## Bug Fixes Applied

### 1. CSS Specificity Issue (Light Mode Purple Not Working)

**Problem:** When selecting purple theme in light mode, it would show green instead.

**Root Cause:** The CSS selector `:root, :root.theme-green` had higher specificity than `:root.theme-purple`. The `:root` part (without any class) would match and apply green colors, overriding the purple theme.

**Solution:** Separated the selectors:
- `:root` - Default green theme (no class)
- `:root.theme-green` - Explicit green theme
- `:root.theme-blue` - Blue theme
- `:root.theme-purple` - Purple theme

This ensures each theme class has equal specificity and can properly override the default.

### 2. Flash on Page Refresh (Dark Mode)

**Problem:** When refreshing the page with purple theme selected in dark mode, there would be a brief flash of green theme on the BETA badge.

**Root Cause:** The blocking script in `layout.tsx` only checked for `'blue'` and `'green'` themes, not `'purple'`.

**Solution:** Updated the blocking script to:
1. Check for all three themes: `'blue' || 'green' || 'purple'`
2. Remove all theme classes before applying the new one: `classList.remove('theme-green', 'theme-blue', 'theme-purple')`

This ensures the correct theme is applied before React loads, preventing any flash.

### 3. Profile Screen Components Not Supporting Purple (Native)

**Problem:** On the profile screen, when purple theme was selected, the language selector and text size selector were showing incorrect colors (green or blue instead of purple).

**Root Cause:** The helper functions in `GeneralTabContent.tsx` and `TextScaleSelector.tsx` only handled green and blue themes, not purple.

**Solution:** Updated the helper functions to include purple theme:

```typescript
// Before
const getActiveBorderClass = () => {
  if (Platform.OS === 'web') {
    return 'border-main bg-main/10'
  }
  return colorTheme === 'blue'
    ? 'border-blue-500 bg-blue-500/10'
    : 'border-green-600 bg-green-600/10'
}

// After
const getActiveBorderClass = () => {
  if (Platform.OS === 'web') {
    return 'border-main bg-main/10'
  }
  if (colorTheme === 'blue') return 'border-blue-500 bg-blue-500/10'
  if (colorTheme === 'purple') return 'border-purple-500 bg-purple-500/10'
  return 'border-green-600 bg-green-600/10'
}
```

Same pattern applied to `getActiveTextClass()` in `GeneralTabContent.tsx`.

### 4. TabLayout Missing Purple Theme (Native)

**Problem:** Native app crashed with "Cannot convert undefined value to object" when selecting purple theme.

**Root Cause:** The `TabLayout` component (`apps/expo/app/(tabs)/_layout.tsx`) had a local `COLOR_THEMES` constant that only included green and blue themes.

**Solution:** Added purple theme colors to the local `COLOR_THEMES` constant in `TabLayout`.

## Future Considerations

- Consider adding more theme colors (e.g., red, orange, teal)
- The theme system is extensible and new colors can be added by:
  1. Adding CSS variables to `global.css` files (both light and dark modes)
  2. Adding color values to `useColorThemeValues.ts`
  3. Updating the `ColorTheme` type in `ColorThemeContext.tsx`
  4. Adding the theme option to `ColorThemeSelector.tsx`
  5. Updating the blocking script in `layout.tsx` to include the new theme
  6. Updating `applyColorThemeToDocument` function to remove the new theme class

