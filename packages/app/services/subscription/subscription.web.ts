/**
 * Web implementation of subscription service using RevenueCat Web SDK
 */

import type {
  ISubscriptionService,
  PurchaseResult,
  RestoreResult,
  CustomerInfo,
  SubscriptionTier,
} from './types'

class WebSubscriptionService implements ISubscriptionService {
  private configured = false
  private Purchases: any = null

  async configure(apiKey: string, userId: string): Promise<void> {
    if (this.configured) return

    try {
      // Dynamic import to avoid issues in SSR and package resolution
      const { Purchases } = await import('@revenuecat/purchases-js')

      await Purchases.configure({
        apiKey,
        appUserId: userId,
      })

      this.Purchases = Purchases
      this.configured = true
    } catch (error) {
      console.error('Failed to configure RevenueCat Web SDK:', error)
      throw error
    }
  }

  isConfigured(): boolean {
    return this.configured
  }

  async purchaseSubscription(tier: 'plus' | 'pro'): Promise<PurchaseResult> {
    if (!this.configured || !this.Purchases) {
      return {
        success: false,
        error: 'Subscription service not configured',
      }
    }

    try {
      const productId = tier === 'plus' ? 'plus_monthly' : 'pro_monthly'

      // Get available packages
      const offerings = await this.Purchases.getOfferings()
      const currentOffering = offerings.current

      if (!currentOffering) {
        return {
          success: false,
          error: 'No subscription offerings available',
        }
      }

      // Find the product
      const product = currentOffering.availablePackages.find(
        (pkg: any) => pkg.product.identifier === productId
      )

      if (!product) {
        return {
          success: false,
          error: `Product ${productId} not found`,
        }
      }

      // Purchase
      const result = await this.Purchases.purchasePackage(product)

      return {
        success: true,
        tier,
        transactionId: result.transaction?.transactionIdentifier,
      }
    } catch (error: any) {
      console.error('Purchase failed:', error)
      return {
        success: false,
        error: error.message || 'Purchase failed',
      }
    }
  }

  async restorePurchases(): Promise<RestoreResult> {
    if (!this.configured || !this.Purchases) {
      return {
        success: false,
        error: 'Subscription service not configured',
      }
    }

    try {
      const customerInfo = await this.Purchases.restorePurchases()
      const tier = this.extractTierFromCustomerInfo(customerInfo)

      return {
        success: true,
        tier,
      }
    } catch (error: any) {
      console.error('Restore purchases failed:', error)
      return {
        success: false,
        error: error.message || 'Failed to restore purchases',
      }
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.configured || !this.Purchases) {
      throw new Error('Subscription service not configured')
    }

    try {
      const info = await this.Purchases.getCustomerInfo()
      const tier = this.extractTierFromCustomerInfo(info)
      const expiresAt = this.extractExpiryDate(info, tier)

      return {
        userId: info.originalAppUserId,
        tier,
        expiresAt,
        isActive: tier !== 'free',
        source: this.extractSource(info, tier),
      }
    } catch (error) {
      console.error('Failed to get customer info:', error)
      // Return default free tier on error
      return {
        userId: '',
        tier: 'free',
        isActive: false,
      }
    }
  }

  async syncEntitlements(): Promise<CustomerInfo> {
    // For web, getCustomerInfo already syncs with server
    return this.getCustomerInfo()
  }

  async logOut(): Promise<void> {
    if (!this.configured || !this.Purchases) {
      return
    }

    try {
      await this.Purchases.logOut()
      this.configured = false
      this.Purchases = null
    } catch (error) {
      console.error('Failed to log out from RevenueCat:', error)
    }
  }

  /**
   * Extract subscription tier from RevenueCat customer info
   */
  private extractTierFromCustomerInfo(info: any): SubscriptionTier {
    const entitlements = info.entitlements?.active

    if (!entitlements || Object.keys(entitlements).length === 0) {
      return 'free'
    }

    // Check for Pro entitlement first
    if (entitlements.pro) {
      return 'pro'
    }

    // Then check for Plus
    if (entitlements.plus) {
      return 'plus'
    }

    return 'free'
  }

  /**
   * Extract expiry date from customer info
   */
  private extractExpiryDate(
    info: any,
    tier: SubscriptionTier
  ): Date | undefined {
    if (tier === 'free') return undefined

    const entitlements = info.entitlements?.active
    const entitlement = entitlements?.[tier]

    if (!entitlement?.expirationDate) return undefined

    return new Date(entitlement.expirationDate)
  }

  /**
   * Determine if subscription was purchased with money or points
   */
  private extractSource(
    info: any,
    tier: SubscriptionTier
  ): 'money' | 'points' | undefined {
    if (tier === 'free') return undefined

    const entitlements = info.entitlements?.active
    const entitlement = entitlements?.[tier]

    // RevenueCat marks promotional grants with store = "promotional"
    if (entitlement?.store === 'promotional') {
      return 'points'
    }

    return 'money'
  }
}

export default new WebSubscriptionService()
