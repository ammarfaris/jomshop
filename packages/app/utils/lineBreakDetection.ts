// Helper to detect suspicious line breaks in text (likely from copy-paste)
export const detectSuspiciousLineBreaks = (text: string): boolean => {
  if (!text || text.length < 20) return false

  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length < 2) return false

  // Check for lines that end mid-sentence (don't end with proper punctuation)
  // This catches cases where a paragraph was broken in the middle
  const properEndings = /[.!?:;。！？：；)\]」』"']$/
  // Check if line ends with common emojis (using character class instead of unicode flag for ES5 compatibility)
  const endsWithEmoji = (str: string): boolean => {
    const lastChar = str.slice(-2) // Emojis can be 2 chars
    return /[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(lastChar)
  }

  let suspiciousBreaks = 0

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]?.trim() || ''
    const nextLine = lines[i + 1]?.trim() || ''

    // Skip if line ends with proper punctuation or emoji
    if (properEndings.test(line) || endsWithEmoji(line)) continue

    // Skip if next line starts with a bullet point, emoji, Roman numerals, or special character (intentional formatting)
    const isNextLineBullet =
      /^[•\-\*➡️☎️✅❌📌🔹🔸▶️►→●○◆◇■□▪▫]/.test(nextLine) ||
      /^[ivxlcdm]+\.\s*/.test(nextLine) ||
      /^\d+\.\s*/.test(nextLine) ||
      /^[a-z]\.\s*/.test(nextLine)
    if (isNextLineBullet) continue

    // Skip if this line itself starts with a bullet (it's a list item, might be intentionally short)
    // But don't skip if the line has substantial content after the bullet (more than just the bullet + short text)
    const lineStartsWithBullet =
      /^[•\-\*➡️☎️✅❌📌🔹🔸▶️►→●○◆◇■□▪▫]/.test(line) ||
      /^[ivxlcdm]+\.\s*/.test(line) ||
      /^\d+\.\s*/.test(line) ||
      /^[a-z]\.\s*/.test(line)
    if (lineStartsWithBullet && line.trim().length < 20) continue // Only skip short bullet lines

    // If line doesn't end properly and next line continues the sentence/phrase
    // This is likely an accidental break
    // But skip if current line starts with bullet (list items don't need punctuation)
    const startsWithLowercase = /^[a-z]/.test(nextLine.trim())
    const looksLikeContinuation =
      /^[A-Z]/.test(nextLine.trim()) && !/^[A-Z][^.!?]*[.!?]/.test(line)

    if (startsWithLowercase || looksLikeContinuation) {
      // Don't flag if current line is a bullet point (list items can end without punctuation)
      if (!lineStartsWithBullet) {
        suspiciousBreaks++
      }
    }
  }

  return suspiciousBreaks > 0
}
