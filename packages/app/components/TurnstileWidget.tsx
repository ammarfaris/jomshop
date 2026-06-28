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
}

export function TurnstileWidget(props: TurnstileWidgetProps) {
  return <TurnstileWidgetImpl {...props} />
}
