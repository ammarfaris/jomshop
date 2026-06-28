# Text Scale Troubleshooting Guide

## Issue 1: Localhost vs Production Font Size Differences

### Problem

Text appears larger on localhost (dev mode) compared to production/staging on iOS Safari and Chrome mobile, despite using the same base font size.

### Root Causes

1. **CSS Processing Differences**

   - Development mode: Next.js serves CSS with hot module replacement
   - Production mode: CSS is minified and optimized
   - This can cause timing issues with CSS variable application

2. **Tailwind JIT Compilation**

   - Dev mode regenerates CSS on-the-fly
   - Production uses pre-built, optimized CSS
   - May result in different specificity or ordering

3. **Browser Caching**
   - Production sites are heavily cached
   - Localhost bypasses most caching
   - Old CSS may persist on production

### Solutions

#### Solution A: Hard Refresh on Production

1. Clear browser cache
2. Hard refresh (Cmd+Shift+R on desktop, or clear Safari cache on iOS)
3. Check if font sizes now match

#### Solution B: Add Cache Busting

Add version query parameter to CSS imports:

```tsx
// apps/next/app/layout.tsx
import './globals.css?v=2'
import './text-scale.css?v=2'
```

#### Solution C: Ensure CSS Variable Priority

Make sure `text-scale.css` is imported AFTER `globals.css` so variables take precedence:

```tsx
import './globals.css'
import './text-scale.css' // Must be after globals.css
```

#### Solution D: Force CSS Variable Application

Add this to `text-scale.css`:

```css
/* Force CSS variables to apply immediately */
html {
  font-size: var(--font-size-base) !important;
}

body * {
  /* Ensure all elements respect text scale */
  font-size: inherit;
}
```

## Issue 2: iOS Simulator Not Updating Font Size

### Problem

Switching text scale in iOS Simulator doesn't change the font size.

### Root Causes

1. **React Native Text Component Caching**

   - Text components may cache font styles
   - Changes to context don't trigger re-render

2. **Missing Force Update**

   - Context updates but components don't re-render
   - Need to force component remount

3. **Simulator-Specific Issues**
   - Simulator may cache styles differently than real devices
   - Hot reload may not work properly with context changes

### Solutions

#### Solution A: Force Component Re-render

Update `TextScaleContext` to include a key that changes:

```tsx
export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>('smaller')
  const [updateKey, setUpdateKey] = useState(0)

  const setTextScale = async (scale: TextScale) => {
    setTextScaleState(scale)
    setUpdateKey((prev) => prev + 1) // Force re-render
    // ... rest of code
  }

  return (
    <TextScaleContext.Provider
      key={updateKey} // Force remount on change
      value={{
        textScale,
        setTextScale,
        isLoading,
        fontSize: FONT_SCALES[textScale],
      }}
    >
      {children}
    </TextScaleContext.Provider>
  )
}
```

#### Solution B: Use Text Component with Dynamic Style

Ensure Text components use inline styles for native:

```tsx
import { useTextScale } from 'app/contexts/TextScaleContext'

function MyComponent() {
  const { fontSize } = useTextScale()

  return (
    <Text style={{ fontSize: fontSize.base }}>This will update on native</Text>
  )
}
```

#### Solution C: Reload App After Scale Change

Add a reload mechanism for native platforms:

```tsx
import { Platform } from 'react-native'
import * as Updates from 'expo-updates'

const setTextScale = async (scale: TextScale) => {
  setTextScaleState(scale)

  // Save preference
  if (user) {
    const currentPrefs = await account.getPrefs()
    await account.updatePrefs({ ...currentPrefs, textScale: scale })
  }

  // Reload app on native to apply changes
  if (Platform.OS !== 'web') {
    setTimeout(() => {
      Updates.reloadAsync()
    }, 500)
  }
}
```

#### Solution D: Test on Real Device

Simulator behavior may differ from real devices. Always test on:

- Real iPhone (iOS Safari)
- Real Android device (Chrome)
- Physical device often shows correct behavior

## Issue 3: iOS Safari Auto-Zoom with 14px Base

### Problem

Using 14px base font size triggers iOS Safari auto-zoom when tapping input fields.

### Trade-offs

**Option A: Keep 14px (Compact)**

- ✅ More content visible
- ✅ Modern, compact design
- ❌ iOS Safari will zoom on input focus
- ❌ User must manually zoom out

**Option B: Use 16px minimum (Safe)**

- ✅ No iOS Safari zoom
- ✅ Better accessibility
- ❌ Less content visible
- ❌ Larger overall appearance

### Recommended Solution

Use 16px as the "smaller" option and adjust the scale:

- Smaller: 16px base (safe, no zoom)
- Regular: 17px base
- Bigger: 18px base

Or provide a warning to users:

```tsx
{
  textScale === 'smaller' && (
    <Text className="text-xs text-yellow-600 mt-1">
      ⚠️ Note: iOS Safari may zoom when tapping input fields with this size
    </Text>
  )
}
```

## Verification Checklist

### Localhost vs Production

- [ ] Clear browser cache
- [ ] Hard refresh both environments
- [ ] Check CSS file order in layout.tsx
- [ ] Verify CSS variables in browser DevTools
- [ ] Compare computed styles in both environments

### iOS Simulator

- [ ] Restart simulator
- [ ] Clear app data
- [ ] Test on real iOS device
- [ ] Check if context value updates (add console.log)
- [ ] Verify fontSize object changes in context

### General

- [ ] Test all three scales (smaller, regular, bigger)
- [ ] Test on multiple browsers (Safari, Chrome, Firefox)
- [ ] Test on multiple devices (iOS, Android, Desktop)
- [ ] Verify persistence (close and reopen app)
- [ ] Check input fields for zoom behavior

## Debug Commands

### Check CSS Variables in Browser Console

```javascript
// Get current text scale
document.documentElement.getAttribute('data-text-scale')

// Get computed font size
getComputedStyle(document.documentElement).getPropertyValue('--font-size-base')

// Check if CSS is loaded
Array.from(document.styleSheets).find((s) => s.href?.includes('text-scale'))
```

### Check Context Value in React DevTools

1. Open React DevTools
2. Find TextScaleProvider component
3. Check state: textScale, fontSize
4. Verify values match expected scale

### Force Reload on Native

```bash
# iOS Simulator
xcrun simctl shutdown all && xcrun simctl boot "iPhone 15"

# Android Emulator
adb shell am force-stop com.yourapp
adb shell am start -n com.yourapp/.MainActivity
```
