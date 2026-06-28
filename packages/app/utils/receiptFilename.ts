/**
 * Utility functions for generating standardized receipt filenames
 */

/**
 * Sanitizes a string for use in filenames
 * - Converts to lowercase
 * - Removes apostrophes and special characters
 * - Replaces spaces with underscores
 * - Removes consecutive underscores
 */
export function sanitizeForFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/['`]/g, '') // Remove apostrophes and backticks
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
}

/**
 * Gets the first two words from a name, or full name if less than 2 words
 * @param name - Full name (e.g., "Ammar Ahmad bin Yusof")
 * @returns First two words (e.g., "ammar_ahmad")
 */
export function getNamePrefix(name: string): string {
  const sanitized = sanitizeForFilename(name)
  const words = sanitized.split('_').filter(Boolean)

  // Take first two words, or all words if less than 2
  const namePrefix = words.slice(0, 2).join('_')

  // If empty after sanitization, use fallback
  return namePrefix || 'user'
}

/**
 * Gets file extension from file type or filename
 * @param fileType - MIME type (e.g., "image/jpeg")
 * @param originalFilename - Original filename (fallback)
 * @returns Extension (e.g., "jpg")
 */
export function getFileExtension(
  fileType: string,
  originalFilename?: string
): string {
  // Try to get extension from MIME type
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  }

  const extFromMime = mimeToExt[fileType.toLowerCase()]
  if (extFromMime) {
    return extFromMime
  }

  // Fallback to extracting from original filename
  if (originalFilename) {
    const match = originalFilename.match(/\.([^.]+)$/)
    if (match && match[1]) {
      return match[1].toLowerCase()
    }
  }

  // Default fallback
  return 'bin'
}

/**
 * Generates a timestamp in the format: YYYYMMDD_HHMMSS
 * @returns Timestamp string (e.g., "20250109_143052")
 */
export function generateTimestamp(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

/**
 * Generates a standardized receipt filename
 * Format: {name_prefix}_{contest_id}_{user_id}_{timestamp}.{ext}
 * Example: ammar_ahmad_68f448b332e2d33ff2c4_6907b9a02675124e1798_20250109_143052.jpg
 *
 * @param userName - User's full name
 * @param contestId - Contest ID
 * @param userId - User ID
 * @param fileType - MIME type (e.g., "image/jpeg")
 * @param originalFilename - Original filename (optional, for extension fallback)
 * @returns Standardized filename
 */
export function generateReceiptFilename(
  userName: string,
  contestId: string,
  userId: string,
  fileType: string,
  originalFilename?: string
): string {
  const namePrefix = getNamePrefix(userName)
  const timestamp = generateTimestamp()
  const extension = getFileExtension(fileType, originalFilename)

  return `${namePrefix}_${contestId}_${userId}_${timestamp}.${extension}`
}

/**
 * Example usage and test cases
 */
// if (__DEV__) {
//   // Test cases for edge cases
//   const testCases = [
//     {
//       name: 'Ammar Ahmad',
//       expected: 'ammar_ahmad',
//       description: 'Normal two-word name',
//     },
//     {
//       name: 'Amarah binti Yuhan',
//       expected: 'amarah_binti',
//       description: 'Name with "binti" (first two words)',
//     },
//     {
//       name: "O'Brien Patrick",
//       expected: 'obrien_patrick',
//       description: 'Name with apostrophe',
//     },
//     {
//       name: 'José María García',
//       expected: 'jos_mara',
//       description: 'Name with accented characters',
//     },
//     {
//       name: 'John',
//       expected: 'john',
//       description: 'Single word name',
//     },
//     {
//       name: 'Mary-Jane Watson',
//       expected: 'maryjane_watson',
//       description: 'Name with hyphen',
//     },
//     {
//       name: '李明',
//       expected: 'user',
//       description: 'Non-Latin characters (fallback)',
//     },
//   ]

//   // Log test results in development
//   console.log('Receipt Filename Test Cases:')
//   testCases.forEach(({ name, expected, description }) => {
//     const result = getNamePrefix(name)
//     const pass = result === expected
//     console.log(`${pass ? '✓' : '✗'} ${description}`)
//     console.log(`  Input: "${name}"`)
//     console.log(`  Expected: "${expected}"`)
//     console.log(`  Got: "${result}"`)
//   })
// }
