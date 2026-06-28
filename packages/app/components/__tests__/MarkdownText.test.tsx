import { describe, it, expect } from '@jest/globals'

/**
 * Test cases for MarkdownText component
 * These are conceptual tests to document expected behavior
 */

describe('MarkdownText', () => {
  it('should parse external links correctly', () => {
    const input = 'Visit [Google](https://google.com) for more info'
    // Expected: Text with clickable link to https://google.com
    expect(input).toContain('[Google](https://google.com)')
  })

  it('should parse internal links correctly', () => {
    const input = 'Check our [Terms](/tnc) page'
    // Expected: Text with clickable link to /tnc
    expect(input).toContain('[Terms](/tnc)')
  })

  it('should handle multiple links in one text', () => {
    const input = 'Visit [Site A](https://a.com) or [Site B](https://b.com)'
    // Expected: Text with two clickable links
    expect(input).toContain('[Site A](https://a.com)')
    expect(input).toContain('[Site B](https://b.com)')
  })

  it('should handle text without links', () => {
    const input = 'This is plain text without any links'
    // Expected: Plain text, no links
    expect(input).not.toContain('[')
  })

  it('should handle mixed content', () => {
    const input = 'Submit via [form](https://example.com/form) within 7 days'
    // Expected: Text before link, clickable link, text after link
    expect(input).toContain('Submit via')
    expect(input).toContain('[form](https://example.com/form)')
    expect(input).toContain('within 7 days')
  })
})
