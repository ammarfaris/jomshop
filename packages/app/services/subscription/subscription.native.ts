/**
 * Native (iOS/Android) implementation stub for subscription service
 * Will be implemented when moving to custom builds with react-native-purchases
 */

import type {
  ISubscriptionService,
  PurchaseResult,
  RestoreResult,
  CustomerInfo,
} from './types'

class NativeSubscriptionService implements ISubscriptionService {
  async configure(apiKey: string, userId: string): Promise<void> {
    throw new Error(
      'Native subscriptions not implemented yet. Please use web for subscriptions.'
    )
  }

  isConfigured(): boolean {
    return false
  }

  async purchaseSubscription(tier: 'plus' | 'pro'): Promise<PurchaseResult> {
    return {
      success: false,
      error:
        'Native subscriptions not implemented yet. Please use web for subscriptions.',
    }
  }

  async restorePurchases(): Promise<RestoreResult> {
    return {
      success: false,
      error:
        'Native subscriptions not implemented yet. Please use web for subscriptions.',
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    // Return free tier for now
    return {
      userId: '',
      tier: 'free',
      isActive: false,
    }
  }

  async syncEntitlements(): Promise<CustomerInfo> {
    return this.getCustomerInfo()
  }

  async logOut(): Promise<void> {
    // No-op for now
  }
}

export default new NativeSubscriptionService()
