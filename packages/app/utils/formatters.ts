/**
 * Format upvote count for display
 * - Numbers < 1000: display as-is (e.g., "0", "123", "999")
 * - Numbers 1000-999999: display with K suffix (e.g., "1.2K", "45.6K")
 * - Numbers >= 1000000: display with M suffix (e.g., "1.5M", "12.3M")
 *
 * @param count - The upvote count to format
 * @returns Formatted string representation of the count
 */
export function formatUpvoteCount(count: number): string {
  if (count < 0) {
    return '0'
  }

  // Round the input to handle decimal values
  const roundedCount = Math.floor(count)

  if (roundedCount < 1000) {
    return roundedCount.toString()
  }

  if (roundedCount < 1000000) {
    const thousands = roundedCount / 1000
    // Round to 1 decimal place
    const rounded = Math.round(thousands * 10) / 10
    // Remove trailing .0 if present
    return rounded % 1 === 0 ? `${Math.floor(rounded)}K` : `${rounded}K`
  }

  const millions = roundedCount / 1000000
  // Round to 1 decimal place
  const rounded = Math.round(millions * 10) / 10
  // Remove trailing .0 if present
  return rounded % 1 === 0 ? `${Math.floor(rounded)}M` : `${rounded}M`
}
