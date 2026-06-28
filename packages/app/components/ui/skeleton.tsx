import { cn } from 'app/lib/utils'
import * as React from 'react'
import { View } from 'react-native'

const Skeleton = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentProps<typeof View>
>(function Skeleton({ className, ...props }, ref) {
  return (
    <View
      ref={ref}
      className={cn('bg-accent web:animate-pulse rounded-md', className)}
      {...props}
    />
  )
})

export { Skeleton }
