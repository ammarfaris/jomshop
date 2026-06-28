import { cn } from 'app/lib/utils'
import * as SwitchPrimitives from '@rn-primitives/switch'
import { Platform } from 'react-native'

function Switch({
  className,
  ...props
}: SwitchPrimitives.RootProps & React.RefAttributes<SwitchPrimitives.RootRef>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex h-[1.15rem] w-8 shrink-0 flex-row items-center rounded-full border shadow-sm shadow-black/5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed',
        }),
        props.checked
          ? 'bg-green-500 border-green-600 dark:bg-green-600 dark:border-green-700'
          : 'bg-red-400 border-red-500 dark:bg-red-700 dark:border-red-800',
        props.disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'bg-white size-4 rounded-full transition-transform',
          Platform.select({
            web: 'pointer-events-none block ring-0',
          }),
          props.checked ? 'translate-x-3.5' : 'translate-x-0'
        )}
      />
    </SwitchPrimitives.Root>
  )
}

export { Switch }
