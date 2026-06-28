import { useEffect, useRef, useState } from 'react'
import { View, Platform } from 'react-native'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { Button } from 'app/components/ui/button'
import { Text } from 'app/components/ui/text'
import { HostImage } from 'app/components/HostImage'

interface HostDoc {
  $id: string
  name: string
  img_id: string
  img_token_secret?: string | null
  img_blurhash: string
  slug?: string
  bio?: string
}

interface DraggableHostBadgeProps {
  host: HostDoc
  index: number
  instanceId: symbol
  onRemove: () => void
  onReorder: (startIndex: number, endIndex: number) => void
}

export function DraggableHostBadge({
  host,
  index,
  instanceId,
  onRemove,
  onReorder,
}: DraggableHostBadgeProps) {
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
        type: 'host-badge',
        hostId: host.$id,
        index,
        instanceId,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })
  }, [host.$id, index, instanceId])

  useEffect(() => {
    if (Platform.OS !== 'web') return

    const element = ref.current
    if (!element) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        source.data.type === 'host-badge' &&
        source.data.instanceId === instanceId,
      getData: () => ({ hostId: host.$id, index }),
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
  }, [host.$id, index, instanceId, onReorder])

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
      {host.img_id ? (
        <HostImage
          imgId={host.img_id}
          imgTokenSecret={host.img_token_secret}
          imgBlurhash={host.img_blurhash}
          width={20}
          height={20}
          borderRadius={10}
          contentFit="cover"
          style={{ marginRight: 6 }}
        />
      ) : (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#ddd',
            marginRight: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 10, color: '#666' }}>
            {host.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text>{host.name}</Text>
      <Button size="sm" variant="ghost" className="ml-2" onPress={onRemove}>
        <Text>×</Text>
      </Button>
    </View>
  )
}

