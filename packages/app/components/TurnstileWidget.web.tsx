import React from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { View } from 'react-native'
import { useColorScheme } from '../hooks/useColorScheme'

interface TurnstileWidgetProps {
  siteKey: string
  onSuccess: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  onReady?: () => void
  resetSignal?: number
}

export function TurnstileWidget({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  onReady,
  resetSignal,
}: TurnstileWidgetProps) {
  const { colorScheme, isDarkColorScheme } = useColorScheme()
  const [key, setKey] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)

  // Show loading indicator initially and when theme changes
  React.useEffect(() => {
    setIsLoading(true)
  }, [key])

  // Re-mount when theme changes
  React.useEffect(() => {
    setKey((prev) => prev + 1)
  }, [colorScheme])

  // Re-mount when the parent bumps resetSignal (after a verify attempt), so the
  // next submit gets a brand-new single-use token instead of replaying a dead one.
  const skipFirstReset = React.useRef(true)
  React.useEffect(() => {
    if (skipFirstReset.current) {
      skipFirstReset.current = false
      return
    }
    setKey((prev) => prev + 1)
  }, [resetSignal])

  // Handle when Turnstile is actually loaded and ready
  const handleTurnstileLoad = React.useCallback(() => {
    // Wait a bit before hiding loading to show smooth transition
    setTimeout(() => {
      setIsLoading(false)
      onReady?.()
    }, 300)
  }, [onReady])

  const handleExpire = React.useCallback(() => {
    // Re-mount widget on expiration
    setKey((prev) => prev + 1)
    onExpire?.()
  }, [onExpire])

  const handleSuccess = React.useCallback(
    (token: string) => {
      // Ensure loading is hidden when widget successfully loads
      if (isLoading) {
        setIsLoading(false)
      }
      onReady?.() // Ensure ready state is set when verification succeeds
      onSuccess(token)
    },
    [onSuccess, onReady, isLoading]
  )

  return (
    <View
      className="w-full flex items-center justify-center my-2"
      style={{ minHeight: 85, position: 'relative' }}
    >
      <Turnstile
        key={key}
        siteKey={siteKey}
        onSuccess={handleSuccess}
        onError={onError}
        onExpire={handleExpire}
        onLoad={handleTurnstileLoad}
        options={{
          theme: isDarkColorScheme ? 'dark' : 'light',
          size: 'normal',
        }}
      />
    </View>
  )
}
