/**
 * Server-side text sanitization function
 * Removes potentially harmful content while preserving normal text
 */

function sanitizeText(input) {
  if (typeof input !== 'string')
    return { sanitized: '', hadDangerousContent: false }

  let sanitized = input
  let hadDangerousContent = false

  // Detect and remove HTML tags
  const htmlTagPattern = /<[^>]*>/g
  if (htmlTagPattern.test(sanitized)) {
    hadDangerousContent = true
  }
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // Detect and remove script-like patterns
  if (/javascript:/gi.test(sanitized)) hadDangerousContent = true
  sanitized = sanitized.replace(/javascript:/gi, '')

  if (/on\w+\s*=/gi.test(sanitized)) hadDangerousContent = true
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')

  // Detect and remove data URLs and other potentially dangerous schemes
  if (/data:\s*[^;]+;base64,/gi.test(sanitized)) hadDangerousContent = true
  sanitized = sanitized.replace(/data:\s*[^;]+;base64,/gi, '')

  if (/vbscript:/gi.test(sanitized)) hadDangerousContent = true
  sanitized = sanitized.replace(/vbscript:/gi, '')

  if (/file:/gi.test(sanitized)) hadDangerousContent = true
  sanitized = sanitized.replace(/file:/gi, '')

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Trim and normalize whitespace
  sanitized = sanitized.trim()

  // Replace multiple spaces with single space (preserve newlines)
  sanitized = sanitized.replace(/ +/g, ' ')

  // Remove excessive newlines (more than 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n')

  return { sanitized, hadDangerousContent }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    // Parse request
    const { text, max_length } = JSON.parse(req.body || '{}')

    // Validate input
    if (typeof text !== 'string') {
      return res.json(
        {
          success: false,
          error: 'Text must be a string',
        },
        400
      )
    }

    // Sanitize the text
    const { sanitized, hadDangerousContent } = sanitizeText(text)

    // Check if sanitization removed all content
    if (!sanitized) {
      return res.json(
        {
          success: false,
          error: 'Invalid content after sanitization',
          sanitized: '',
          hadDangerousContent,
        },
        400
      )
    }

    // Check max length if provided
    if (max_length && sanitized.length > max_length) {
      return res.json(
        {
          success: false,
          error: `Content exceeds maximum length of ${max_length} characters`,
          sanitized: sanitized.substring(0, max_length),
          hadDangerousContent,
        },
        400
      )
    }

    // Return sanitized text
    return res.json({
      success: true,
      sanitized,
      original_length: text.length,
      sanitized_length: sanitized.length,
      was_modified: text !== sanitized,
      hadDangerousContent, // Flag to indicate if HTML/script tags were removed
    })
  } catch (err) {
    error(`Sanitization error: ${err.message}`)
    return res.json(
      {
        success: false,
        error: 'Sanitization failed',
      },
      500
    )
  }
}
