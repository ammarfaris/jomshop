import { useEffect, useRef, useState } from 'react'
import { View, Platform } from 'react-native'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { Button } from 'app/components/ui/button'
import { Text } from 'app/components/ui/text'

interface CategoryDoc {
  $id: string
  name_en: string
}

interface DraggableCategoryBadgeProps {
  category: CategoryDoc
  index: number
  instanceId: symbol
  onRemove: () => void
  onReorder: (startIndex: number, endIndex: number) => void
}

export function DraggableCategoryBadge({
  category,
  index,
  instanceId,
  onRemove,
  onReorder,
}: DraggableCategoryBadgeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isOver, setIsOver] = useState(false)

  // Only enable drag-and-drop on web
  useEffect(() => {
    if (Platform.OS !== 'web') return

    const element = ref.current
    if (!element) return

    return draggable({
      element,
      getInitialData: () => ({
        type: 'category-badge',
        categoryId: category.$id,
        index,
        instanceId,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })
  }, [category.$id, index, instanceId])

  useEffect(() => {
    if (Platform.OS !== 'web') return

    const element = ref.current
    if (!element) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        source.data.type === 'category-badge' &&
        source.data.instanceId === instanceId,
      getData: () => ({ categoryId: category.$id, index }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false)
        const startIndex = source.data.index as number
        const endIndex = index

        if (startIndex !== endIndex) {
          onReorder(startIndex, endIndex)
        }
      },
    })
  }, [category.$id, index, instanceId, onReorder])

  return (
    <View
      ref={Platform.OS === 'web' ? (ref as any) : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: isOver ? '#805AD5' : '#ddd',
        backgroundColor: isOver ? 'rgba(128, 90, 213, 0.1)' : 'transparent',
        opacity: isDragging ? 0.5 : 1,
        ...(Platform.OS === 'web' ? {
          cursor: 'grab' as const,
          transition: 'all 0.2s ease',
        } : {}),
      } as any}
    >
      {Platform.OS === 'web' && (
        <Text
          style={{
            marginRight: 6,
            fontSize: 12,
            color: '#999',
            ...(Platform.OS === 'web' ? {
              cursor: 'grab' as const,
              userSelect: 'none' as const,
            } : {}),
          } as any}
        >
          ⋮⋮
        </Text>
      )}
      <Text>{category.name_en}</Text>
      <Button size="sm" variant="ghost" className="ml-2" onPress={onRemove}>
        <Text>×</Text>
      </Button>
    </View>
  )
}

