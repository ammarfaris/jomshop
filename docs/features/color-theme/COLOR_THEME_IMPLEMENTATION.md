# Color Theme Implementation

## Overview

This document describes the implementation of the color theme system in JomContest, which allows users to switch between Green (default) and Blue color themes. The implementation is inspired by [shadcn/ui themes](https://ui.shadcn.com/themes) and uses CSS variables with Tailwind CSS and NativeWind for cross-platform support.

## Features

- **Two Color Themes**: Green (default) and Blue
- **Persistent Preferences**: Theme choice is saved to Appwrite user preferences
- **Cross-Platform**: Works on both web (Next.js) and native (Expo/React Native)
- **Seamless Switching**: Theme changes apply instantly across the entire app
- **Dark Mode Support**: Both themes work properly in light and dark modes

## Architecture

### 1. Color Theme Context (`ColorThemeContext.tsx`)

The `ColorThemeContext` manages the global color theme state and provides:

- Current color theme (`'green'` or `'blue'`)
- Function to change the theme
- Loading state
- Automatic persistence to Appwrite user preferences
- Automatic theme application on web (via document class manipulation)

**Location**: `packages/app/contexts/ColorThemeContext.tsx`

```typescript
export type ColorTheme = 'green' | 'blue'

interface ColorThemeContextType {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => Promise<void>
  isLoading: boolean
}
```

### 2. CSS Variables

Color themes are implemented using CSS variables that change based on the theme class applied to the document root.

**Files**:
- `apps/expo/global.css` (for Expo/React Native)
- `apps/next/app/globals.css` (for Next.js)

**Theme Classes**:
- `.theme-green` - Green theme (default)
- `.theme-blue` - Blue theme

**Main Color Variables**:
- `--main`: Primary theme color
- `--main-foreground`: Foreground color for text on the main color

**Example**:
```css
/* Green theme (default) */
:root,
:root.theme-green {
  --main: 142.1 76.2% 36.3%;
  --main-foreground: 355.7 100% 97.3%;
}

/* Blue theme */
:root.theme-blue {
  --main: 217.2 91.2% 59.8%;
  --main-foreground: 222.2 47.4% 11.2%;
}
```

### 3. Color Theme Selector Component

A UI component that allows users to select their preferred color theme.

**Location**: `packages/app/features/profile/components/ColorThemeSelector.tsx`

**Features**:
- Visual preview of each theme with emoji indicators
- Shows current selection
- Loading state during theme change
- Internationalized labels

### 4. Integration with Provider Tree

The `ColorThemeProvider` is added to the app's provider composition to make the theme context available throughout the app.

**Location**: `packages/app/provider/index.tsx`

```typescript
const Providers = compose([
  AuthProvider,
  TextScaleProvider,
  ColorThemeProvider, // Added here
  SafeArea,
  // ...
])
```

## Usage

### Using the Theme in Components

Replace hardcoded color classes with the `main` color variable:

**Before**:
```tsx
<Text className="text-blue-500">Active</Text>
<View className="bg-blue-100 border-blue-500" />
```

**After**:
```tsx
<Text className="text-main">Active</Text>
<View className="bg-main/10 border-main" />
```

### Common Patterns

1. **Text Color**:
   ```tsx
   className="text-main"
   ```

2. **Background Color**:
   ```tsx
   className="bg-main"
   ```

3. **Background with Opacity**:
   ```tsx
   className="bg-main/10"  // 10% opacity
   className="bg-main/20"  // 20% opacity
   ```

4. **Border Color**:
   ```tsx
   className="border-main"
   ```

5. **ActivityIndicator Color** (React Native):
   ```tsx
   <ActivityIndicator color="hsl(var(--main))" />
   ```

### Accessing Theme in Code

```tsx
import { useColorTheme } from 'app/contexts/ColorThemeContext'

function MyComponent() {
  const { colorTheme, setColorTheme, isLoading } = useColorTheme()
  
  // Current theme: 'green' or 'blue'
  console.log(colorTheme)
  
  // Change theme
  await setColorTheme('blue')
}
```

## Components Updated

The following components have been updated to use the theme color system:

### Core UI Components
- `SaveButton.tsx` - Bookmark icon and text when saved
- `UpvoteButton.tsx` - Upvote icon and text when upvoted
- `ShareButton.tsx` - Share icon and text after sharing
- `MarkdownText.tsx` - Link colors

### Profile Components
- `ThemeSelector.web.tsx` - Active theme indicator
- `TextScaleSelector.tsx` - Active scale indicator
- `ReceiptManagerModal.tsx` - Contest count indicator
- `ReceiptThumbnail.tsx` - Edit button and hover state

### Contest Components
- `ContestDetailScreen.tsx`:
  - "Ends in" badge
  - "What is this?" info button
  - Terms & Conditions link
  - FAQ link
  - Social media card background

### Other Components
- `FeedbackDialog.tsx` - Clear button

## Platform-Specific Behavior

### Web (Next.js)
- Theme is applied by adding/removing CSS classes on `document.documentElement`
- Theme changes are instant and affect all CSS variables
- Theme preference is loaded from Appwrite on mount

### Native (Expo/React Native)
- NativeWind v4 supports CSS variables on native
- Theme is stored in context and Appwrite preferences
- Components use the same Tailwind classes as web
- For ActivityIndicator and other native components that need raw color values, use `hsl(var(--main))`

## Data Persistence

Theme preferences are stored in Appwrite user preferences:

```typescript
// Save theme
await account.updatePrefs({ 
  ...currentPrefs, 
  colorTheme: 'blue' 
})

// Load theme
const prefs = await account.getPrefs()
const savedTheme = prefs.colorTheme // 'green' or 'blue'
```

## Color Values

### Green Theme
**Light Mode**:
- Main: `hsl(142.1, 76.2%, 36.3%)` - Vibrant green
- Main Foreground: `hsl(355.7, 100%, 97.3%)` - Near white

**Dark Mode**:
- Main: `hsl(142.1, 70.6%, 45.3%)` - Lighter green
- Main Foreground: `hsl(144.9, 80.4%, 10%)` - Dark green

### Blue Theme
**Light Mode**:
- Main: `hsl(217.2, 91.2%, 59.8%)` - Vibrant blue
- Main Foreground: `hsl(222.2, 47.4%, 11.2%)` - Dark blue

**Dark Mode**:
- Main: `hsl(217.2, 91.2%, 59.8%)` - Same vibrant blue
- Main Foreground: `hsl(222.2, 47.4%, 11.2%)` - Same dark blue

## Adding New Themes

To add a new color theme:

1. **Add theme type** in `ColorThemeContext.tsx`:
   ```typescript
   export type ColorTheme = 'green' | 'blue' | 'purple'
   ```

2. **Add CSS variables** in both `global.css` files:
   ```css
   :root.theme-purple {
     --main: /* your color */;
     --main-foreground: /* your foreground */;
   }
   
   .dark:root.theme-purple {
     --main: /* your dark mode color */;
     --main-foreground: /* your dark mode foreground */;
   }
   ```

3. **Update ColorThemeSelector** to include the new theme option:
   ```typescript
   const themes = [
     { theme: 'green', label: 'Green', emoji: '🟢', description: 'Fresh & Natural' },
     { theme: 'blue', label: 'Blue', emoji: '🔵', description: 'Cool & Professional' },
     { theme: 'purple', label: 'Purple', emoji: '🟣', description: 'Creative & Bold' },
   ]
   ```

4. **Update validation** in `ColorThemeContext.tsx`:
   ```typescript
   if (savedColorTheme && ['green', 'blue', 'purple'].includes(savedColorTheme))
   ```

## Testing

### Manual Testing Checklist

- [ ] Switch between Green and Blue themes in profile settings
- [ ] Verify theme persists after app reload
- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Verify all interactive elements (upvote, save, share) use theme color
- [ ] Test on web (Next.js)
- [ ] Test on iOS (Expo)
- [ ] Test on Android (Expo)
- [ ] Verify theme syncs across tabs (web only)
- [ ] Test with no user logged in (should default to green)

### Visual Testing

Check these components in both themes:
1. Contest cards (upvote/save buttons when active)
2. Contest detail screen (badges, links, social media card)
3. Profile screen (theme selector, text scale selector)
4. Receipt manager modal
5. Feedback dialog

## Troubleshooting

### Theme not applying on web
- Check browser console for errors
- Verify `document.documentElement.classList` contains `theme-green` or `theme-blue`
- Clear browser cache and reload

### Theme not persisting
- Check Appwrite connection
- Verify user is logged in
- Check browser console for Appwrite API errors

### Colors not updating on native
- Restart the app
- Verify NativeWind is properly configured
- Check that `global.css` is imported in the app entry point

## Future Enhancements

Potential improvements for the color theme system:

1. **More Themes**: Add additional color options (purple, orange, red, etc.)
2. **Custom Colors**: Allow users to create custom themes with color pickers
3. **Theme Preview**: Show a preview of the entire app in the selected theme
4. **Automatic Theme**: Auto-select theme based on time of day or user activity
5. **Theme Animations**: Add smooth transitions when switching themes
6. **Accessibility**: Ensure all themes meet WCAG contrast requirements

## References

- [shadcn/ui Themes](https://ui.shadcn.com/themes)
- [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Tailwind CSS Custom Properties](https://tailwindcss.com/docs/customizing-colors#using-css-variables)

