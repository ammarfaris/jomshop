# Icon Component Usage Guide

This guide demonstrates how to use the updated `Icon` component with your custom `icons-svg` system.

## Overview

The `Icon` component has been refactored to use the custom `icons-svg` icon system instead of `lucide-react-native`. It now integrates seamlessly with `IconWrapper` for proper theming and styling across all platforms.

## Basic Usage

### Import the Icon component and your desired icon

```tsx
import { Icon } from 'app/components/ui/icon'
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
```

> **Note:** All icons use named exports for consistency. Always use the pattern `import { IconName } from 'app/components/icons-svg/IconName'`.

### Simple icon rendering

```tsx
<Icon as={CheckOutline} size={16} />
```

### With className (Tailwind classes)

```tsx
<Icon as={CheckOutline} size={16} className="text-muted-foreground" />
```

### With custom color

```tsx
<Icon as={CheckOutline} size={24} color="#ff0000" />
```

## Usage with Toggle Component

The `Toggle` component from React Native Reusables now works seamlessly with our icon system:

```tsx
import { Toggle, ToggleIcon } from 'app/components/ui/toggle'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'

function BookmarkToggle() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <Toggle pressed={pressed} onPressedChange={setPressed}>
      <ToggleIcon as={pressed ? BookmarkSolidIcon : BookmarkIcon} />
    </Toggle>
  )
}
```

### Toggle with text and icon

```tsx
import { Toggle, ToggleIcon } from 'app/components/ui/toggle'
import { Text } from 'app/components/ui/text'
import { BellAlertOutline } from 'app/components/icons-svg/BellAlertOutline'

function NotificationToggle() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <Toggle pressed={pressed} onPressedChange={setPressed} variant="outline">
      <ToggleIcon as={BellAlertOutline} />
      <Text>Notifications</Text>
    </Toggle>
  )
}
```

## Usage with Select Component

The `Select` component has been updated to use the new `Icon` component internally:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'app/components/ui/select'

function CategorySelect() {
  const [value, setValue] = React.useState<string>()

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem label="Technology" value="tech">
            Technology
          </SelectItem>
          <SelectItem label="Design" value="design">
            Design
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

## Advanced Usage

### With variant override

```tsx
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'

// Force solid variant even if icon is outline
<Icon as={CheckOutline} size={16} variant="solid" />

// Force outline variant even if icon is solid
<Icon as={BookmarkSolidIcon} size={16} variant="outline" />
```

### With custom stroke width

```tsx
<Icon as={CheckOutline} size={16} strokeWidth={2.5} />
```

### With inverted colors

```tsx
// Disable automatic color inversion based on theme
<Icon as={CheckOutline} size={16} colorInverted={false} />
```

### With custom fill color (for solid icons)

```tsx
<Icon as={BookmarkSolidIcon} size={16} fillColor="#3b82f6" />
```

## Props Reference

### Icon Props

| Prop            | Type                   | Default  | Description                                   |
| --------------- | ---------------------- | -------- | --------------------------------------------- |
| `as`            | `IconComponentType`    | Required | The icon component from icons-svg to render   |
| `size`          | `number`               | `14`     | Icon size in pixels                           |
| `className`     | `string`               | -        | Tailwind utility classes (web only)           |
| `color`         | `string`               | -        | Custom color (overrides theme and className)  |
| `fillColor`     | `string`               | -        | Custom fill color for solid icons             |
| `style`         | `ViewStyle`            | -        | Additional inline styles                      |
| `variant`       | `'solid' \| 'outline'` | -        | Force icon variant (overrides auto-detection) |
| `colorInverted` | `boolean`              | `true`   | Whether to invert color based on theme        |
| `strokeWidth`   | `number`               | -        | Custom stroke width for outline icons         |

## Supported Tailwind Color Classes

The `Icon` component automatically maps these Tailwind text color classes to actual colors:

- `text-foreground` - Primary text color (black in light mode, white in dark mode)
- `text-muted-foreground` - Muted text color (gray-600 in light mode, gray-400 in dark mode)
- `text-accent-foreground` - Accent text color
- `text-primary` - Primary color
- `text-secondary` - Secondary color

## Migration from Lucide Icons

If you're migrating from components that used `lucide-react-native`, here's how to update them:

### Before (Lucide)

```tsx
import { Check } from 'lucide-react-native'
import { Icon } from 'app/components/ui/icon'
;<Icon as={Check} size={16} className="text-foreground" />
```

### After (icons-svg)

```tsx
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { Icon } from 'app/components/ui/icon'
;<Icon as={CheckOutline} size={16} className="text-foreground" />
```

## Creating New Icons

To add new icons to the `icons-svg` system:

1. Create a new file in `packages/app/components/icons-svg/`
2. Use the pattern from existing icons (e.g., `CheckOutline.tsx`)
3. Configure the icon with `configureIcon` utility
4. Apply `iconWithClassName` for NativeWind support

Example:

```tsx
import Svg, { SvgProps, Path } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

const SvgComponent = (props: SvgProps) => (
  <Svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="YOUR_SVG_PATH_HERE" />
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5,
  isSolid: false, // Set to true for solid icons
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as YourIconName }
export default ConfiguredIcon
```

## Benefits of the New System

1. **Consistent theming**: Automatic color adaptation based on light/dark mode
2. **Modular**: Easy to replace icons across all React Native Reusables components
3. **Type-safe**: Full TypeScript support with proper type definitions
4. **Platform-agnostic**: Works seamlessly on web, iOS, and Android
5. **NativeWind compatible**: Full support for Tailwind utility classes
6. **Customizable**: Extensive props for fine-tuned control over appearance
