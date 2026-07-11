# Icons-SVG System

Custom SVG icon system for the application with full React Native and Web support.

## 📁 Structure

```
icons-svg/
├── utils/
│   ├── IconWrapper.tsx        # Main wrapper component
│   ├── iconUtils.ts           # Icon configuration utilities
│   └── iconWIthClassName.ts   # Legacy no-op (kept for compatibility)
├── [IconName].tsx             # Individual icon components
└── README.md                  # This file
```

## 🎯 Export Standard

**All icon components use named exports only.**

```tsx
// ✅ Correct
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'

// ❌ Wrong
import CheckOutline from 'app/components/icons-svg/CheckOutline'
```

**Exception:** Utility components like `IconWrapper` use default exports.

```tsx
// ✅ Correct for utilities
import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
```

## 🚀 Usage

### Direct Usage (Legacy)

```tsx
import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'

;<IconWrapper Icon={CheckOutline} size={24} color="#000000" />
```

### Recommended Usage (via Icon component)

```tsx
import { Icon } from 'app/components/ui/icon'
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'

;<Icon as={CheckOutline} size={24} className="text-foreground" />
```

## 📝 Creating New Icons

Use this template for all new icons:

```tsx
// https://heroicons.com/outline
// icon-name
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
  isSolid: false, // true for solid icons
})
iconWithClassName(ConfiguredIcon)

// ✅ Named export only
export { ConfiguredIcon as YourIconName }
```

### For Solid Icons

```tsx
const SvgComponent = (props: SvgProps) => (
  <Svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <Path fillRule="evenodd" d="YOUR_SVG_PATH_HERE" clipRule="evenodd" />
  </Svg>
)

const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5,
  isSolid: true, // ← Set to true
})
```

## 📦 Available Icons

### Common Icons

- `CheckOutline` - Checkmark
- `ChevronDownOutline` / `ChevronUpOutline` - Arrows
- `SearchOutline` - Search
- `HomeOutline` - Home
- `XMarkOutline` - Close/dismiss
- `ShareOutline` - Share

### User & Profile

- `UserCircleOutline` - User profile
- `BookmarkIcon` / `BookmarkSolidIcon` - Bookmark states
- `BellAlertOutline` / `BellAlertSolid` - Notifications
- `ArrowUpCircleOutline` / `ArrowUpCircleSolid` - Upvote

### Settings & Actions

- `Cog6ToothOutline` / `Cog6ToothSolid` - Settings
- `TrashOutline` - Delete
- `FunnelOutline` - Filter
- `EllipsisHorizontalOutline` - More options
- `LogoutOutline` - Sign out

### Other

- `ListBulletOutline` - List view
- `BuildingLibraryOutline` - Organization/library
- `GoogleSolid` - Google logo

## 🔧 Icon Configuration

### Icon Metadata

Icons can have metadata attached:

```tsx
configureIcon(SvgComponent, {
  strokeWidth: 1.5, // Default stroke width
  isSolid: false, // Whether it's a solid icon
})
```

### Icon Coloring

Icons are colored via explicit `stroke` / `fill` props computed in `IconWrapper`
(driven by `useColorScheme` and the `color` prop). The `iconWithClassName` call
in icon modules is a legacy no-op kept so existing icons don't need to change:

```tsx
iconWithClassName(ConfiguredIcon)
```

On web, `className` still passes through to the DOM and `icon.tsx` maps common
Tailwind text colors to a concrete `color`.

## 🎨 IconWrapper Props

| Prop            | Type                   | Default  | Description                       |
| --------------- | ---------------------- | -------- | --------------------------------- |
| `Icon`          | `ComponentType`        | Required | The icon component to render      |
| `size`          | `number`               | `24`     | Icon size in pixels               |
| `color`         | `string`               | Auto     | Icon color (auto-adapts to theme) |
| `fillColor`     | `string`               | Auto     | Fill color for solid icons        |
| `style`         | `ViewStyle`            | -        | Additional styles                 |
| `variant`       | `'solid' \| 'outline'` | Auto     | Force variant                     |
| `colorInverted` | `boolean`              | `true`   | Invert color based on theme       |
| `strokeWidth`   | `number`               | `1.5`    | Stroke width for outline icons    |
| `className`     | `string`               | -        | Tailwind classes (web only)       |

## 📚 Documentation

- **Icon Component Guide**: `../ui/ICON_USAGE_EXAMPLE.md`
- **Quick Reference**: `../ui/ICON_QUICK_REFERENCE.md`
- **Export Standard**: `EXPORT_STANDARDIZATION.md`
- **Toggle Examples**: `../ui/TOGGLE_EXAMPLE.tsx`

## ✅ Best Practices

1. **Always use named imports** for icon components
2. **Use the Icon component** from `app/components/ui/icon` instead of IconWrapper directly
3. **Pair outline/solid variants** for toggle states
4. **Use semantic classNames** for better theme support
5. **Memoize icon components** for performance
6. **Configure icon metadata** using `configureIcon`

## 🔄 Migration from Default Exports

If you have old code using default imports:

```tsx
// Old (no longer works)
import CheckOutline from 'app/components/icons-svg/CheckOutline'

// New (correct)
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
```

## 📊 Status

✅ All icons standardized to named exports
✅ Full TypeScript support
✅ Theme-aware coloring
✅ Cross-platform compatible
✅ Documented and tested

---

_Last Updated: 2025-10-20_
