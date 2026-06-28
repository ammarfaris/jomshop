# Drag and Drop Quick Reference

## Installation

```bash
yarn workspace app add @atlaskit/pragmatic-drag-and-drop
```

## Basic Setup

```typescript
import { useState, useMemo } from 'react'
import { DraggableHostBadge } from 'app/components/admin/DraggableHostBadge'

// 1. Create instance ID
const instanceId = useMemo(() => Symbol('hosts'), [])

// 2. Create reorder handler
const handleReorder = (startIndex: number, endIndex: number) => {
  const newItems = [...items]
  const [moved] = newItems.splice(startIndex, 1)
  newItems.splice(endIndex, 0, moved)
  setItems(newItems)
}

// 3. Render badges
{items.map((item, index) => (
  <DraggableHostBadge
    key={item.$id}
    host={item}
    index={index}
    instanceId={instanceId}
    onRemove={() => removeItem(item.$id)}
    onReorder={handleReorder}
  />
))}
```

## Component Props

### DraggableHostBadge

| Prop | Type | Description |
|------|------|-------------|
| `host` | `HostDoc` | Host data object |
| `index` | `number` | Current position in array |
| `instanceId` | `symbol` | Unique drag context identifier |
| `onRemove` | `() => void` | Called when × is clicked |
| `onReorder` | `(start, end) => void` | Called when dropped |

### DraggableCategoryBadge

| Prop | Type | Description |
|------|------|-------------|
| `category` | `CategoryDoc` | Category data object |
| `index` | `number` | Current position in array |
| `instanceId` | `symbol` | Unique drag context identifier |
| `onRemove` | `() => void` | Called when × is clicked |
| `onReorder` | `(start, end) => void` | Called when dropped |

## Common Patterns

### Multiple Lists

```typescript
// Use different instanceIds for each list
const hostInstanceId = useMemo(() => Symbol('hosts'), [])
const categoryInstanceId = useMemo(() => Symbol('categories'), [])

// Hosts
{hosts.map((host, index) => (
  <DraggableHostBadge
    instanceId={hostInstanceId}
    {...otherProps}
  />
))}

// Categories
{categories.map((category, index) => (
  <DraggableCategoryBadge
    instanceId={categoryInstanceId}
    {...otherProps}
  />
))}
```

### Sync Multiple State Arrays

```typescript
const handleReorder = (startIndex: number, endIndex: number) => {
  const newItems = [...items]
  const [moved] = newItems.splice(startIndex, 1)
  newItems.splice(endIndex, 0, moved)
  
  // Update both arrays
  setItems(newItems)
  setItemIds(newItems.map(i => i.$id))
}
```

### Platform-Specific Rendering

```typescript
import { Platform } from 'react-native'

{Platform.OS === 'web' && items.length > 1 && (
  <Text className="text-xs text-gray-500">
    (Drag to reorder)
  </Text>
)}
```

## Visual States

| State | Appearance |
|-------|------------|
| Normal | White background, gray border |
| Hover | Grab cursor |
| Dragging | 50% opacity |
| Drop Zone | Purple border, light purple background |

## Drag Handle

```
⋮⋮  (vertical ellipsis)
```

- Color: `#999`
- Position: Left side of badge
- Visibility: Web only
- Cursor: `grab`

## Performance Optimization

```typescript
// ✅ Good - memoized
const instanceId = useMemo(() => Symbol('hosts'), [])

// ✅ Good - callback
const handleReorder = useCallback((start, end) => {
  // ... logic
}, [dependencies])

// ✅ Good - stable key
key={item.$id}

// ❌ Bad - recreated every render
const instanceId = Symbol('hosts')

// ❌ Bad - inline function
onReorder={(s, e) => { /* ... */ }}

// ❌ Bad - unstable key
key={index}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Drag not working | Check `Platform.OS === 'web'` |
| Items jumping | Use array index: `.map((item, index) => ...)` |
| Order not saving | Update both state arrays |
| Wrong drop zone | Use unique `instanceId` per list |

## File Locations

```
packages/app/
├── components/admin/
│   ├── DraggableHostBadge.tsx
│   └── DraggableCategoryBadge.tsx
├── features/admin/
│   ├── CreateContestTabContent.tsx  (integrated)
│   └── EditContestTabContent.tsx    (integrated)
└── docs/features/drag-and-drop/
    ├── IMPLEMENTATION_SUMMARY.md
    ├── USAGE_GUIDE.md
    └── QUICK_REFERENCE.md
```

## Testing Checklist

- [ ] Drag works on web
- [ ] Visual feedback present
- [ ] Order persists
- [ ] Remove button works
- [ ] No console errors
- [ ] Works in both tabs

## Key Concepts

### Instance ID
```typescript
const id = useMemo(() => Symbol('name'), [])
```
- Unique identifier for drag context
- Prevents cross-list dragging
- Must be stable (use useMemo)

### Reorder Logic
```typescript
const [moved] = array.splice(startIndex, 1)  // Remove
array.splice(endIndex, 0, moved)              // Insert
```

### Platform Detection
```typescript
if (Platform.OS !== 'web') return  // Skip on native
```

## API Reference

### Pragmatic Drag and Drop

```typescript
import { 
  draggable, 
  dropTargetForElements 
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

// Make element draggable
draggable({
  element: ref.current,
  getInitialData: () => ({ type, id, index }),
  onDragStart: () => {},
  onDrop: () => {},
})

// Make element a drop target
dropTargetForElements({
  element: ref.current,
  canDrop: ({ source }) => source.data.type === 'expected-type',
  getData: () => ({ id, index }),
  onDragEnter: () => {},
  onDragLeave: () => {},
  onDrop: ({ source }) => {},
})
```

## Bundle Size

| Package | Size |
|---------|------|
| @atlaskit/pragmatic-drag-and-drop | 45KB |
| bind-event-listener | ~10KB |
| raf-schd | ~5KB |
| **Total** | **~60KB** |

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (web view)
- ❌ IE11 (not supported)

## Resources

- [Pragmatic DnD Docs](https://atlassian.design/components/pragmatic-drag-and-drop)
- [Comparison Guide](https://atlassian.design/components/pragmatic-drag-and-drop/comparison)
- [Element Adapter](https://atlassian.design/components/pragmatic-drag-and-drop/element-adapter)
- [Examples](https://atlassian.design/components/pragmatic-drag-and-drop/examples)

## Version Info

- **Library:** @atlaskit/pragmatic-drag-and-drop v1.7.7
- **Implemented:** November 19, 2024
- **Platform:** Web only
- **React:** Compatible with React 18+
- **React Native:** Compatible with RN 0.79+

