/**
 * Platform-agnostic subscription service interface
 * Abstracts RevenueCat implementation details for web and native platforms
 */

export type SubscriptionTier = 'free' | 'plus' | 'pro'

export interface PurchaseResult {
  success: boolean
  tier?: SubscriptionTier
  error?: string
  transactionId?: string
}

export interface RestoreResult {
  success: boolean
  tier?: SubscriptionTier
  error?: string
}

export interface CustomerInfo {
  userId: string
  tier: SubscriptionTier
  expiresAt?: Date
  isActive: boolean
  source?: 'money' | 'points'
}

export interface ISubscriptionService {
  /**
   * Initialize the subscription service with API key and user ID
   * Note: RevenueCat Web SDK requires userId to be provided
   */
  configure(apiKey: string, userId: string): Promise<void>

  /**
   * Check if the service is configured and ready
   */
  isConfigured(): boolean

  /**
   * Purchase a subscription tier
   */
  purchaseSubscription(tier: 'plus' | 'pro'): Promise<PurchaseResult>

  /**
   * Restore previous purchases (useful after app reinstall)
   */
  restorePurchases(): Promise<RestoreResult>

  /**
   * Get current customer info from RevenueCat
   */
  getCustomerInfo(): Promise<CustomerInfo>

  /**
   * Log out and clear customer info
   */
  logOut(): Promise<void>

  /**
   * Sync with RevenueCat to get latest entitlements
   */
  syncEntitlements(): Promise<CustomerInfo>
}
