// adjusted by AI to make it work with nextjs
import { Icon } from 'app/components/ui/icon'
import { NativeOnlyAnimatedView } from 'app/components/ui/native-only-animated-view'
import { cn } from 'app/lib/utils'
import * as DialogPrimitive from '@rn-primitives/dialog'
import { XMarkOutline } from '../icons-svg'
import * as React from 'react'
import { Keyboard, Platform, Text, View, type ViewProps } from 'react-native'
import { FadeIn, FadeOut } from 'react-native-reanimated'
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const FullWindowOverlay =
  Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment

function DialogOverlay({
  className,
  children,
  ...props
}: Omit<DialogPrimitive.OverlayProps, 'asChild'> &
  React.RefAttributes<DialogPrimitive.OverlayRef> & {
    children?: React.ReactNode
  }) {
  const handleOverlayPress = React.useCallback((event: any) => {
    // Only dismiss keyboard if tapping the overlay itself, not the content
    if (Platform.OS !== 'web' && event.target === event.currentTarget) {
      Keyboard.dismiss()
    }
  }, [])

  return (
    <FullWindowOverlay>
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-black/50 p-2',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',
          }),
          className
        )}
        onPress={handleOverlayPress}
        {...props}
        asChild={Platform.OS !== 'web'}
      >
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          onTouchEnd={Platform.OS !== 'web' ? handleOverlayPress : undefined}
        >
          <NativeOnlyAnimatedView
            entering={FadeIn.delay(50)}
            exiting={FadeOut.duration(150)}
          >
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
    </FullWindowOverlay>
  )
}
function DialogContent({
  className,
  portalHost,
  children,
  ...props
}: DialogPrimitive.ContentProps &
  React.RefAttributes<DialogPrimitive.ContentRef> & {
    portalHost?: string
  }) {
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        <DialogPrimitive.Content
          className={cn(
            'bg-background border-border z-50 mx-auto flex w-full max-w-[calc(100%-1rem)] flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-xl overflow-visible',
            Platform.select({
              // Remove transform-based zoom animations on web to prevent iOS Safari input zoom
              web: 'animate-in fade-in-0 duration-200 transform-none',
            }),
            className
          )}
          role={Platform.OS === 'web' ? 'dialog' : undefined}
          {...props}
        >
          <>{children}</>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',
              Platform.select({
                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
              })
            )}
            hitSlop={Platform.OS !== 'web' ? 24 : 12}
          >
            <Icon
              as={XMarkOutline}
              size={24}
              className="text-accent-foreground web:pointer-events-none shrink-0"
            />
            <Text className="sr-only">Close</Text>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.TitleProps & React.RefAttributes<DialogPrimitive.TitleRef>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-foreground text-lg font-semibold leading-none',
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DescriptionProps &
  React.RefAttributes<DialogPrimitive.DescriptionRef>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
