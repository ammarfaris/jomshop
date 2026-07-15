import { describe, it, expect } from '@jest/globals'
import {
  isRelativeMarkdownHref,
  isSafeMarkdownHref,
} from '../markdownLinkSafety'

describe('markdownLinkSafety', () => {
  it('allows only http(s) absolute links', () => {
    expect(isSafeMarkdownHref('https://google.com')).toBe(true)
    expect(isSafeMarkdownHref('http://example.com/faq')).toBe(true)
    expect(isSafeMarkdownHref('mailto:test@example.com')).toBe(false)
    expect(isSafeMarkdownHref('javascript:alert(1)')).toBe(false)
    expect(isSafeMarkdownHref('data:text/html;base64,PHNjcmlwdA==')).toBe(false)
  })

  it('allows relative links used inside the app', () => {
    expect(isRelativeMarkdownHref('/contest/new-year')).toBe(true)
    expect(isRelativeMarkdownHref('./terms')).toBe(true)
    expect(isRelativeMarkdownHref('../help')).toBe(true)
    expect(isRelativeMarkdownHref('#how-to-enter')).toBe(true)
    expect(isRelativeMarkdownHref('https://google.com')).toBe(false)
  })

  it('rejects empty or malformed href values', () => {
    expect(isSafeMarkdownHref('')).toBe(false)
    expect(isSafeMarkdownHref('   ')).toBe(false)
    expect(isSafeMarkdownHref('www.example.com/no-scheme')).toBe(false)
    expect(isSafeMarkdownHref(':/broken')).toBe(false)
  })
})
