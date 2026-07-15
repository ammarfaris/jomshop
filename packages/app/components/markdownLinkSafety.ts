export function isRelativeMarkdownHref(href: string): boolean {
  return (
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('#')
  )
}

export function isSafeMarkdownHref(rawHref: string): boolean {
  const href = rawHref.trim()
  if (!href) return false
  if (isRelativeMarkdownHref(href)) return true

  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
