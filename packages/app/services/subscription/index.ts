/**
 * Platform-agnostic subscription service
 * Exports the appropriate implementation based on the platform
 */

import { Platform } from 'react-native'
import type { ISubscriptionService } from './types'

let service: ISubscriptionService

if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  service = require('./subscription.web').default
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  service = require('./subscription.native').default
}

export default service
export * from './types'
