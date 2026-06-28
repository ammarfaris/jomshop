import { Icon } from 'app/components/ui/icon'
import { cn } from 'app/lib/utils'
import * as CheckboxPrimitive from '@rn-primitives/checkbox'
import { CheckOutline } from 'app/components/icons-svg/CheckOutline'
import { Platform } from 'react-native'
import { useColorScheme } from 'app/hooks/useColorScheme'

const DEFAULT_HIT_SLOP = 24

function Checkbox({
  className,
  checkedClassName,
  indicatorClassName,
  iconClassName,
  ...props
}: CheckboxPrimitive.RootProps &
  React.RefAttributes<CheckboxPrimitive.RootRef> & {
    checkedClassName?: string
    indicatorClassName?: string
    iconClassName?: string
  }) {
  const { isDarkColorScheme } = useColorScheme()
  // bg-primary is black in light mode, white in dark mode
  // So the checkmark must be the inverse: white in light mode, black in dark mode
  const checkmarkColor = isDarkColorScheme ? '#000000' : '#ffffff'

  return (
    <CheckboxPrimitive.Root
      className={cn(
        'border-input dark:border-gray-500 dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-sm shadow-black/5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive peer cursor-default outline-none transition-shadow focus-visible:ring-[3px] disabled:cursor-not-allowed',
          native: 'overflow-hidden',
        }),
        props.checked && cn('border-primary', checkedClassName),
        props.disabled && 'opacity-50',
        className
      )}
      hitSlop={DEFAULT_HIT_SLOP}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          'flex bg-primary h-full w-full items-center justify-center',
          indicatorClassName
        )}
      >
        <Icon
          as={CheckOutline}
          size={12}
          strokeWidth={Platform.OS === 'web' ? 2.5 : 3.5}
          color={checkmarkColor}
          className={cn('text-primary-foreground', iconClassName)}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
