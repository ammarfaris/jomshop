# Text Scale Feature

## Overview

The text scale feature allows users to adjust the base font size across the entire app to improve readability. This is particularly important for:

1. **iOS Safari Auto-Zoom Prevention**: iOS Safari automatically zooms in when input fields have font-size < 16px. By ensuring all base font sizes are >= 16px, we prevent this behavior.
2. **Accessibility**: Users can choose a comfortable reading size.
3. **Consistency**: Font sizes scale proportionally across the entire app.

## Implementation

### Architecture

The text scale system consists of:

1. **TextScaleContext** (`packages/app/contexts/TextScaleContext.tsx`)

   - Manages text scale state (smaller, regular, bigger)
   - Provides font size values for each scale
   - Persists preference to the user's Supabase profile preferences
   - Applies scale to document root on web

2. **TextScaleSelector** (`packages/app/features/profile/components/TextScaleSelector.tsx`)

   - UI component for selecting text scale
   - Located in Profile > General tab

3. **CSS Variables** (`apps/next/app/text-scale.css`)

   - Defines CSS variables for each scale
   - Overrides Tailwind text size classes
   - Ensures all inputs have proper font size

4. **useTextScaleStyle Hook** (`packages/app/hooks/useTextScaleStyle.ts`)
   - Helper hook for applying text scale to inline styles
   - Returns empty styles on web (uses CSS variables)
   - Returns actual font sizes on native

### Font Size Scales

All scales ensure base font size >= 16px to prevent iOS Safari zoom:

| Size | Smaller (Default) | Regular | Bigger |
| ---- | ----------------- | ------- | ------ |
| xs   | 12px              | 13px    | 14px   |
| sm   | 14px              | 15px    | 16px   |
| base | 16px              | 17px    | 18px   |
| lg   | 18px              | 19px    | 20px   |
| xl   | 20px              | 22px    | 24px   |
| 2xl  | 24px              | 26px    | 28px   |

**Default Scale**: "Smaller" (16px base) is the default to provide a compact, modern reading experience while still preventing iOS Safari auto-zoom.

### Usage

#### In Components (Tailwind Classes)

On web, Tailwind classes automatically use CSS variables:

```tsx
<Text className="text-base">This text scales automatically</Text>
<Text className="text-sm">Smaller text that scales</Text>
```

#### In Inline Styles

For inputs and textareas that need explicit font sizes:

```tsx
import { useTextScale } from 'app/contexts/TextScaleContext'

function MyComponent() {
  const { fontSize } = useTextScale()

  return (
    <TextInput
      style={{
        fontSize: fontSize.base, // >= 16px to prevent iOS zoom
        // ... other styles
      }}
    />
  )
}
```

#### For Native-Only Styling

Use the `useTextScaleStyle` hook:

```tsx
import { useTextScaleStyle } from 'app/hooks/useTextScaleStyle'

function MyComponent() {
  const textStyle = useTextScaleStyle()

  return <Text style={[styles.text, textStyle.base]}>Scaled text</Text>
}
```

## iOS Safari Zoom Prevention

The key to preventing iOS Safari auto-zoom is ensuring all input fields have `font-size >= 16px`. This is achieved through:

1. **Base font size**: All scales have base >= 16px
2. **CSS enforcement**: `text-scale.css` applies font-size to all inputs
3. **Inline styles**: Components use `fontSize.base` from context

### Additional Techniques (from FeedbackDialog)

The FeedbackDialog demonstrates additional iOS Safari zoom prevention:

```tsx
// 1. Disable zoom while dialog is open
useEffect(() => {
  if (open) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    )
  }
  return () => {
    // Restore zoom settings when closed
    viewport.setAttribute('content', original)
  }
}, [open])

// 2. Prevent double-tap zoom
document.addEventListener('dblclick', preventDblClick, { passive: false })

// 3. Prevent gesture zoom
document.addEventListener('gesturestart', preventGesture, { passive: false })
```

## User Experience

1. **Default**: App starts with "smaller" scale (16px base) for a compact, modern look
2. **Selection**: Users can change scale in Profile > General tab
3. **Visual Preview**: Each button shows "Aa" in the actual font size (16px, 17px, 18px) so users can see the difference before selecting
4. **Persistence**: Preference is saved to the Supabase profile and persists across sessions
5. **Immediate Effect**: Changes apply instantly across the app
6. **Cross-Platform**: Works on web and native (iOS/Android)

## Testing

### Test Cases

1. **Scale Selection**

   - Navigate to Profile > General
   - Select each scale option (smaller, regular, bigger)
   - Verify text size changes immediately

2. **iOS Safari Zoom**

   - Open app in iOS Safari
   - Tap on any input field
   - Verify browser does NOT zoom in

3. **Persistence**

   - Change text scale
   - Close and reopen app
   - Verify scale preference is maintained

4. **Cross-Platform**
   - Test on web (Chrome, Safari, Firefox)
   - Test on iOS native app
   - Test on Android native app

### Known Issues

- **Production vs Localhost**: If you see different font sizes between localhost and production, ensure:
  1. Tailwind CSS is properly built
  2. `text-scale.css` is imported in layout
  3. Browser cache is cleared

## Future Enhancements

1. **More Scale Options**: Add "extra small" and "extra large" options
2. **Per-Component Scaling**: Allow users to scale specific UI elements
3. **Dynamic Range**: Let users set custom font size multipliers
4. **Accessibility Integration**: Integrate with system accessibility settings

## Related Files

- `packages/app/contexts/TextScaleContext.tsx` - Context provider
- `packages/app/features/profile/components/TextScaleSelector.tsx` - UI selector
- `packages/app/hooks/useTextScaleStyle.ts` - Style helper hook
- `apps/next/app/text-scale.css` - CSS variables and overrides
- `apps/next/app/layout.tsx` - CSS import
- `packages/app/provider/index.tsx` - Provider composition
