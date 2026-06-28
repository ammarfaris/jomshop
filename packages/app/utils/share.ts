import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * Share content structure for contest sharing
 */
export interface ShareContent {
  title: string
  message: string
  url: string
}

/**
 * Parameters for generating share content
 */
export interface GenerateShareContentParams {
  contestId: string
  contestTitle: string
  language: 'en' | 'ms'
}

/**
 * Supported social media platforms for sharing
 */
export type SocialPlatform = 'facebook' | 'twitter' | 'whatsapp' | 'telegram'

/**
 * Generate localized share content for a contest
 *
 * @param params - Contest information and language preference
 * @returns ShareContent object with title, message, and URL
 */
export function generateShareContent(
  params: GenerateShareContentParams
): ShareContent {
  const { contestId, contestTitle, language } = params

  // Generate the contest URL
  const url = generateContestUrl(contestId)

  // Generate localized share message
  const message =
    language === 'ms'
      ? i18n._(msg`Lihat peraduan ini di JomContest!`)
      : i18n._(msg`Check out this contest on JomContest!`)

  return {
    title: contestTitle,
    message,
    url,
  }
}

/**
 * Generate the full URL for a contest
 *
 * @param contestId - The contest slug or ID
 * @returns Full contest URL
 */
export function generateContestUrl(contestId: string): string {
  // Sanitize the contest ID/slug
  const sanitizedId = encodeURIComponent(contestId)

  // Get base URL from environment or current origin
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL || 'https://jomcontest.com'

  return `${baseUrl}/contest/${sanitizedId}`
}

/**
 * Generate a social media platform-specific share URL
 *
 * @param platform - The social media platform
 * @param content - The share content
 * @returns Platform-specific share URL
 */
export function getSocialShareUrl(
  platform: SocialPlatform,
  content: ShareContent
): string {
  const { title, message, url } = content

  // Encode parameters for URL safety
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(`${message} ${title}`)

  switch (platform) {
    case 'facebook':
      // Facebook Share Dialog
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`

    case 'twitter':
      // Twitter/X Share Intent
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`

    case 'whatsapp':
      // WhatsApp Share
      return `https://wa.me/?text=${encodedText}%20${encodedUrl}`

    case 'telegram':
      // Telegram Share
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`

    default:
      // This should never happen due to TypeScript, but handle it gracefully
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
