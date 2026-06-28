# Icon Component Quick Reference

## Import

```tsx
import { Icon } from 'app/components/ui/icon'
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
```

## Basic Usage

```tsx
// Simple
<Icon as={CheckOutline} />

// With size
<Icon as={CheckOutline} size={24} />

// With className
<Icon as={CheckOutline} className="text-muted-foreground" />

// With custom color
<Icon as={CheckOutline} color="#ff0000" />
```

## Toggle Usage

```tsx
import { Toggle, ToggleIcon } from 'app/components/ui/toggle'
import { BookmarkIcon } from 'app/components/icons-svg/BookmarkIcon'
import { BookmarkSolidIcon } from 'app/components/icons-svg/BookmarkSolidIcon'
;<Toggle pressed={isPressed} onPressedChange={setIsPressed}>
  <ToggleIcon as={isPressed ? BookmarkSolidIcon : BookmarkIcon} />
</Toggle>
```

## Select Usage

Already integrated! Just use Select components as normal:

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'app/components/ui/select'
;<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem label="Option 1" value="opt1">
      Option 1
    </SelectItem>
  </SelectContent>
</Select>
```

## Common Props

| Prop        | Type                 | Default  | Example                     |
| ----------- | -------------------- | -------- | --------------------------- |
| `as`        | Icon Component       | Required | `as={CheckOutline}`         |
| `size`      | number               | 14       | `size={24}`                 |
| `className` | string               | -        | `className="text-blue-500"` |
| `color`     | string               | -        | `color="#ff0000"`           |
| `variant`   | 'solid' \| 'outline' | auto     | `variant="solid"`           |

## Common Tailwind Classes

```tsx
className = 'text-foreground' // Primary text color
className = 'text-muted-foreground' // Muted/gray color
className = 'text-accent-foreground' // Accent color
className = 'text-primary' // Primary brand color
className = 'text-destructive' // Error/danger color
```

## Available Icons

### Common Icons

- `CheckOutline` - Checkmark
- `ChevronDownOutline` / `ChevronUpOutline` - Arrows
- `BookmarkIcon` / `BookmarkSolidIcon` - Bookmark states
- `BellAlertOutline` / `BellAlertSolid` - Notifications
- `ArrowUpCircleOutline` / `ArrowUpCircleSolid` - Upvote
- `SearchOutline` - Search
- `HomeOutline` - Home
- `UserCircleOutline` - User profile
- `ShareOutline` - Share
- `XMarkOutline` - Close/dismiss

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

## Tips

1. **Use semantic classNames** instead of hardcoded colors for better theme support
2. **Pair outline/solid variants** for toggle states (pressed/unpressed)
3. **Default size is 14px** - increase for better touch targets on mobile
4. **Icons auto-adapt to theme** unless you override with `color` prop
5. **Use `ToggleIcon`** wrapper inside Toggle components for proper styling

## Need More?

- Full documentation: `ICON_USAGE_EXAMPLE.md`
- Code examples: `TOGGLE_EXAMPLE.tsx`
- Migration guide: `MIGRATION_SUMMARY.md`
