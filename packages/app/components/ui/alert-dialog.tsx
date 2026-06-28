// adjusted by AI to make it work with nextjs
import * as AlertDialogPrimitive from '@rn-primitives/alert-dialog'
import * as React from 'react'
import { Platform, View, type ViewProps } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { buttonTextVariants, buttonVariants } from 'app/components/ui/button'
import { cn } from 'app/lib/utils'
import { TextClassContext } from 'app/components/ui/text'

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

function AlertDialogOverlayWeb({
  className,
  children,
  ...props
}: AlertDialogPrimitive.OverlayProps & {
  ref?: React.RefObject<AlertDialogPrimitive.OverlayRef>
}) {
  const { open } = AlertDialogPrimitive.useRootContext()
  console.log(
    'AlertDialogOverlayWeb rendering, open:',
    open,
    'children:',
    children
  )
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        'z-50 bg-black/80 flex justify-center items-center p-2 absolute top-0 right-0 bottom-0 left-0',
        open
          ? 'web:animate-in web:fade-in-0'
          : 'web:animate-out web:fade-out-0',
        className
      )}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9998,
      }}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Overlay>
  )
}

function AlertDialogOverlayNative({
  className,
  children,
  ...props
}: AlertDialogPrimitive.OverlayProps & {
  ref?: React.RefObject<AlertDialogPrimitive.OverlayRef>
}) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        'z-50 absolute top-0 right-0 bottom-0 left-0 bg-black/80 flex justify-center items-center p-2',
        className
      )}
      {...props}
      asChild
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
      >
        {children}
      </Animated.View>
    </AlertDialogPrimitive.Overlay>
  )
}

const AlertDialogOverlay = Platform.select({
  web: AlertDialogOverlayWeb,
  default: AlertDialogOverlayNative,
})

function AlertDialogContent({
  className,
  portalHost,
  ...props
}: AlertDialogPrimitive.ContentProps & {
  ref?: React.RefObject<AlertDialogPrimitive.ContentRef>
  portalHost?: string
}) {
  const { open } = AlertDialogPrimitive.useRootContext()

  return (
    <AlertDialogPortal hostName={portalHost}>
      <AlertDialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
        style={
          Platform.select({
            web: {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Use a very high z-index on web to ensure we overlay RN Web Modal containers
              // RN Web Modal commonly uses very high stacking contexts
              zIndex: 2147483646,
            },
            default: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            },
          }) as any
        }
      >
        <AlertDialogPrimitive.Content
          className={cn(
            'relative z-50 max-w-lg gap-4 border border-border bg-background p-6 shadow-lg shadow-foreground/10 web:duration-200 rounded-lg text-foreground',
            // Remove transform-based zoom animations on web to avoid iOS Safari zoom quirks
            open
              ? 'web:animate-in web:fade-in-0'
              : 'web:animate-out web:fade-out-0',
            className
          )}
          role={Platform.OS === 'web' ? 'dialog' : undefined}
          style={
            Platform.select({
              web: {
                position: 'relative',
                zIndex: 51,
                minWidth: '300px',
                maxWidth: '500px',
              },
              default: {
                position: 'relative',
                zIndex: 51,
                minWidth: 300,
                maxWidth: 500,
              },
            }) as any
          }
          {...props}
        />
      </AlertDialogPrimitive.Overlay>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col gap-2', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-4 sm:gap-2',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.TitleProps & {
  ref?: React.RefObject<AlertDialogPrimitive.TitleRef>
}) {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        'text-lg native:text-xl text-foreground font-semibold',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.DescriptionProps & {
  ref?: React.RefObject<AlertDialogPrimitive.DescriptionRef>
}) {
  return (
    <AlertDialogPrimitive.Description
      className={cn(
        'text-sm native:text-base text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: AlertDialogPrimitive.ActionProps & {
  ref?: React.RefObject<AlertDialogPrimitive.ActionRef>
}) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ className })}>
      <AlertDialogPrimitive.Action
        className={cn(buttonVariants(), className)}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.CancelProps & {
  ref?: React.RefObject<AlertDialogPrimitive.CancelRef>
}) {
  return (
    <TextClassContext.Provider
      value={buttonTextVariants({ className, variant: 'outline' })}
    >
      <AlertDialogPrimitive.Cancel
        className={cn(buttonVariants({ variant: 'outline', className }))}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
