# Color Theme System - Quick Reference

## TL;DR

Users can now choose between **Green** (default) and **Blue** color themes from their profile settings. The theme applies to all interactive elements and links throughout the app.

## For Developers

### Use Theme Colors in Components

Replace hardcoded blue colors with theme-aware classes:

```tsx
// ❌ Don't use hardcoded colors
className="text-blue-500"
className="bg-blue-100"
className="border-blue-500"

// ✅ Use theme colors
className="text-main"
className="bg-main/10"
className="border-main"
```

### Common Patterns

| Use Case | Class Name | Example |
|----------|-----------|---------|
| Text color | `text-main` | Active state labels |
| Background | `bg-main` | Buttons, badges |
| Background (10% opacity) | `bg-main/10` | Subtle backgrounds |
| Background (20% opacity) | `bg-main/20` | Card backgrounds |
| Border | `border-main` | Active borders |
| Border (20% opacity) | `border-main/20` | Subtle borders |

### For Native Components

When you need raw color values (e.g., ActivityIndicator):

```tsx
<ActivityIndicator color="hsl(var(--main))" />
```

### Access Theme in Code

```tsx
import { useColorTheme } from 'app/contexts/ColorThemeContext'

function MyComponent() {
  const { colorTheme, setColorTheme, isLoading } = useColorTheme()
  
  // colorTheme is 'green' or 'blue'
  // setColorTheme('blue') to change theme
}
```

## Where to Find Things

| What | Location |
|------|----------|
| Context | `packages/app/contexts/ColorThemeContext.tsx` |
| Selector UI | `packages/app/features/profile/components/ColorThemeSelector.tsx` |
| CSS Variables (Expo) | `apps/expo/global.css` |
| CSS Variables (Next) | `apps/next/app/globals.css` |
| Documentation | `docs/features/color-theme/` |

## Theme Colors

### Green (Default)
- Light: `hsl(142.1, 76.2%, 36.3%)`
- Dark: `hsl(142.1, 70.6%, 45.3%)`

### Blue
- Light: `hsl(217.2, 91.2%, 59.8%)`
- Dark: `hsl(217.2, 91.2%, 59.8%)`

## Components Using Theme Colors

- ✅ SaveButton (bookmark when saved)
- ✅ UpvoteButton (arrow when upvoted)
- ✅ ShareButton (icon after sharing)
- ✅ MarkdownText (links)
- ✅ ContestDetailScreen (badges, links, social card)
- ✅ Profile components (selectors, indicators)
- ✅ Receipt components (buttons, hover states)
- ✅ FeedbackDialog (clear button)

## Testing Checklist

- [ ] Switch themes in profile settings
- [ ] Verify theme persists after reload
- [ ] Test in light and dark modes
- [ ] Check all interactive elements
- [ ] Test on web and native

## Need Help?

See full documentation: `docs/features/color-theme/COLOR_THEME_IMPLEMENTATION.md`

