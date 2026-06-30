import { Platform } from 'react-native'

// Import platform-specific implementations
const TurnstileWidgetImpl = Platform.select({
  ios: () => require('./TurnstileWidget.ios').TurnstileWidget,
  android: () => require('./TurnstileWidget.android').TurnstileWidget,
  default: () => require('./TurnstileWidget.web').TurnstileWidget,
})()

interface TurnstileWidgetProps {
  siteKey: string
  onSuccess: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  onReady?: () => void // New callback when widget is ready
  // Bump this to force the widget to re-mint a token (Turnstile tokens are
  // single-use, so a fresh one is needed after every verify attempt).
  resetSignal?: number
}

export function TurnstileWidget(props: TurnstileWidgetProps) {
  return <TurnstileWidgetImpl {...props} />
}
