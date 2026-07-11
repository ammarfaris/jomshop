# Drag and Drop Usage Guide

## For Admins Using the Feature

### How to Reorder Hosts

1. Navigate to **Admin Panel** → **Create Contest** or **Edit Contest** tab
2. Select multiple hosts using the "Select / Manage Hosts" button
3. Once you have 2+ hosts, you'll see a "(Drag to reorder)" hint
4. **To reorder:**
   - Hover over any host badge
   - Click and hold on the drag handle (⋮⋮) or anywhere on the badge
   - Drag to the desired position
   - Release to drop
5. The new order will be saved when you submit the form

### How to Reorder Categories

Same process as hosts:
1. Select multiple categories
2. Drag badges to reorder
3. Order is saved on form submission

### Visual Cues

- **Drag Handle:** ⋮⋮ appears on the left of each badge
- **Cursor:** Changes to "grab" when hovering
- **During Drag:** Badge becomes semi-transparent
- **Drop Zone:** Target position highlights with purple border

### Tips

- You can still remove badges using the × button
- Drag-and-drop only works on **web** (desktop/laptop browsers)
- On mobile apps, you'll need to remove and re-add to change order
- The first host/category in the list appears first on the contest page

## For Developers

### Using DraggableHostBadge

```typescript
import { DraggableHostBadge } from 'app/components/admin/DraggableHostBadge'

// In your component
const hostInstanceId = useMemo(() => Symbol('hosts'), [])

const handleHostReorder = (startIndex: number, endIndex: number) => {
  const newHosts = [...hosts]
  const [movedHost] = newHosts.splice(startIndex, 1)
  newHosts.splice(endIndex, 0, movedHost)
  setHosts(newHosts)
}

// In render
{hosts.map((host, index) => (
  <DraggableHostBadge
    key={host.$id}
    host={host}
    index={index}
    instanceId={hostInstanceId}
    onRemove={() => handleRemove(host.$id)}
    onReorder={handleHostReorder}
  />
))}
```

### Using DraggableCategoryBadge

```typescript
import { DraggableCategoryBadge } from 'app/components/admin/DraggableCategoryBadge'

// Similar usage as DraggableHostBadge
const categoryInstanceId = useMemo(() => Symbol('categories'), [])

{categories.map((category, index) => (
  <DraggableCategoryBadge
    key={category.$id}
    category={category}
    index={index}
    instanceId={categoryInstanceId}
    onRemove={() => handleRemove(category.$id)}
    onReorder={handleCategoryReorder}
  />
))}
```

### Key Props Explained

#### `index: number`
- The current position in the array
- **Must** be accurate for drag-drop to work correctly
- Use array index from `.map((item, index) => ...)`

#### `instanceId: symbol`
- Unique identifier for the drag-drop context
- Prevents conflicts between different draggable lists
- Create once with `useMemo(() => Symbol('unique-name'), [])`
- **Important:** Use different symbols for different lists (hosts vs categories)

#### `onReorder: (startIndex: number, endIndex: number) => void`
- Called when user drops badge in new position
- Implement array reordering logic here
- Update both the display array and any ID arrays

### Example: Complete Implementation

```typescript
import { useState, useMemo } from 'react'
import { View } from 'react-native'
import { DraggableHostBadge } from 'app/components/admin/DraggableHostBadge'

function MyComponent() {
  const [hosts, setHosts] = useState<HostDoc[]>([])
  const [hostIds, setHostIds] = useState<string[]>([])
  
  // Create unique instance ID
  const hostInstanceId = useMemo(() => Symbol('hosts'), [])
  
  // Reorder handler
  const handleHostReorder = (startIndex: number, endIndex: number) => {
    const newHosts = [...hosts]
    const [movedHost] = newHosts.splice(startIndex, 1)
    newHosts.splice(endIndex, 0, movedHost)
    
    setHosts(newHosts)
    setHostIds(newHosts.map(h => h.$id))
  }
  
  // Remove handler
  const handleRemoveHost = (hostId: string) => {
    setHosts(prev => prev.filter(h => h.$id !== hostId))
    setHostIds(prev => prev.filter(id => id !== hostId))
  }
  
  return (
    <View className="flex-row flex-wrap">
      {hosts.map((host, index) => (
        <DraggableHostBadge
          key={host.$id}
          host={host}
          index={index}
          instanceId={hostInstanceId}
          onRemove={() => handleRemoveHost(host.$id)}
          onReorder={handleHostReorder}
        />
      ))}
    </View>
  )
}
```

### Platform Considerations

The components automatically handle platform differences:

```typescript
// Web: Full drag-drop functionality
if (Platform.OS === 'web') {
  // Drag handle visible
  // Drag-drop enabled
}

// Native: Static badges
if (Platform.OS !== 'web') {
  // No drag handle
  // No drag-drop
  // Remove button still works
}
```

### Styling Customization

To customize the badge appearance, modify the inline styles in the component:

```typescript
// In DraggableHostBadge.tsx or DraggableCategoryBadge.tsx
<View
  style={{
    // Customize these values
    borderColor: isOver ? '#805AD5' : '#ddd',
    backgroundColor: isOver ? 'rgba(128, 90, 213, 0.1)' : 'transparent',
    opacity: isDragging ? 0.5 : 1,
    // ... other styles
  }}
>
```

### Performance Tips

1. **Use useMemo for instanceId:**
   ```typescript
   const instanceId = useMemo(() => Symbol('name'), [])
   ```

2. **Use useCallback for reorder functions:**
   ```typescript
   const handleReorder = useCallback((start, end) => {
     // ... reorder logic
   }, [dependencies])
   ```

3. **Keep key stable:**
   ```typescript
   key={item.$id} // ✅ Good - stable ID
   key={index}    // ❌ Bad - changes on reorder
   ```

### Troubleshooting

#### Drag not working
```typescript
// Check 1: Are you on web?
console.log('Platform:', Platform.OS) // Should be 'web'

// Check 2: Is instanceId created correctly?
const instanceId = useMemo(() => Symbol('hosts'), []) // ✅

// Check 3: Is index passed correctly?
{items.map((item, index) => (
  <DraggableBadge index={index} /> // ✅
))}
```

#### Items jumping during drag
```typescript
// Ensure index is from array position
{items.map((item, index) => ( // ✅ Use this index
  <DraggableBadge index={index} />
))}

// Don't use custom index
{items.map((item) => (
  <DraggableBadge index={item.customIndex} /> // ❌
))}
```

#### Order not persisting
```typescript
// Update both arrays
const handleReorder = (start, end) => {
  const newItems = [...items]
  const [moved] = newItems.splice(start, 1)
  newItems.splice(end, 0, moved)
  
  setItems(newItems)                    // ✅
  setItemIds(newItems.map(i => i.$id)) // ✅ Don't forget this!
}
```

## Testing Your Implementation

### Manual Testing Checklist

- [ ] Can drag badges to reorder
- [ ] Visual feedback during drag (opacity, cursor)
- [ ] Drop zones highlight correctly
- [ ] Order persists after reordering
- [ ] Remove button still works
- [ ] Multiple reorders work correctly
- [ ] Works in both Create and Edit tabs
- [ ] No errors in console

### Automated Testing

```typescript
// Example test (if using testing library)
test('reorders hosts when dragged', () => {
  const hosts = [
    { $id: '1', name: 'Host A' },
    { $id: '2', name: 'Host B' },
    { $id: '3', name: 'Host C' },
  ]
  
  const handleReorder = jest.fn()
  
  render(
    <DraggableHostBadge
      host={hosts[0]}
      index={0}
      instanceId={Symbol('test')}
      onReorder={handleReorder}
      onRemove={() => {}}
    />
  )
  
  // Simulate drag from index 0 to index 2
  // ... drag simulation code
  
  expect(handleReorder).toHaveBeenCalledWith(0, 2)
})
```

## FAQ

### Q: Can I use this on mobile apps?
**A:** The drag-drop functionality is web-only. On native apps, badges will render without drag handles and users can reorder by removing and re-adding items.

### Q: Can I customize the drag handle icon?
**A:** Yes, edit the drag handle in the component file:
```typescript
<Text style={{ ... }}>
  ⋮⋮  {/* Change this to any icon/emoji */}
</Text>
```

### Q: Can I add animations?
**A:** Yes, Pragmatic Drag and Drop supports animations. See the [official docs](https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/react-beautiful-dnd-migration) for examples.

### Q: Why use Symbol for instanceId?
**A:** Symbols are guaranteed unique and prevent accidental conflicts between different drag-drop contexts. This ensures hosts can't be dropped into category areas and vice versa.

### Q: Can I drag between different lists?
**A:** Not with the current implementation. Each list (hosts, categories) is isolated. To enable cross-list dragging, you'd need to use the same `instanceId` and add additional logic.

## Support

For issues or questions:
1. Review [Pragmatic Drag and Drop docs](https://atlassian.design/components/pragmatic-drag-and-drop)
2. Check browser console for errors
3. Verify you're testing on web platform

## Related Documentation

- [Pragmatic Drag and Drop Comparison](https://atlassian.design/components/pragmatic-drag-and-drop/comparison)
- [Element Adapter API](https://atlassian.design/components/pragmatic-drag-and-drop/element-adapter)

