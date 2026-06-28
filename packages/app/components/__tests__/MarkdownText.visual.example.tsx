/**
 * Visual Test Examples for MarkdownText Component
 *
 * This file contains example text that can be used to manually test
 * the MarkdownText component in the admin forms.
 *
 * Copy and paste these examples into the "Entry Method & Submission" field
 * in the admin panel to see how they render.
 */

export const MARKDOWN_TEST_EXAMPLES = {
  // Basic external link
  basic_external:
    'Submit your entry via [our contest form](https://example.com/form) before the deadline.',

  // Basic internal link
  basic_internal: 'Read our [Terms and Conditions](/tnc) for more details.',

  // Multiple external links
  multiple_external:
    'Visit [Shopee](https://shopee.com.my) or [Lazada](https://lazada.com.my) to purchase eligible products.',

  // Mixed internal and external
  mixed_links:
    'Submit via [this form](https://example.com/submit) and check our [FAQ](/faq) for questions.',

  // Email link
  email_link:
    'For support, contact [support@example.com](mailto:support@example.com) or call us.',

  // Complex example with multiple links
  complex: `Purchase any participating product worth RM50 and above from [Shopee](https://shopee.com.my/brand-store) or [Lazada](https://lazada.com.my/brand-store). 

Submit your receipt via [our form](https://example.com/submit) within 7 days of purchase. 

For questions, visit our [FAQ page](/faq) or contact [support@example.com](mailto:support@example.com).

Winners will be announced on our [website](/winners) on March 1st. See [Terms & Conditions](/tnc) for full details.`,

  // No links (should render as plain text)
  no_links: 'This is plain text without any links. It should render normally.',

  // Link at the beginning
  link_at_start:
    '[Click here](https://example.com) to submit your entry before the deadline.',

  // Link at the end
  link_at_end:
    'Submit your entry before the deadline at [this link](https://example.com).',

  // Adjacent links
  adjacent_links:
    'Visit [Site A](https://a.com)[Site B](https://b.com) for more info.',

  // Link with special characters in text
  special_chars_text:
    'Submit via [our form (2024)](https://example.com/form-2024) today!',

  // Link with query parameters
  query_params:
    'Track your entry at [this page](https://example.com/track?id=12345&ref=contest).',

  // Real-world e-commerce example
  ecommerce: `1. Purchase any 2 participating products from [Shopee](https://shopee.com.my/brand) or [Lazada](https://lazada.com.my/brand)
2. Keep your receipt
3. Upload receipt photo via [contest form](https://example.com/upload)
4. Submit within 7 days of purchase

Need help? Visit [Help Center](/help) or email [support@brand.com](mailto:support@brand.com).`,

  // Real-world social media example
  social_media: `How to Enter:
1. Follow us on [Instagram](https://instagram.com/brand)
2. Like and share this post
3. Tag 3 friends in the comments
4. Submit your entry at [contest.brand.com](https://contest.brand.com)

Winners announced on [our website](/winners) on March 15th.`,
}

/**
 * Test Cases for Manual Verification
 *
 * When testing, verify:
 * 1. Links are clickable and styled in blue with underline
 * 2. External links open in browser/new tab
 * 3. Internal links navigate within the app
 * 4. Text without links renders normally
 * 5. Multiple links in one text all work correctly
 * 6. Dark mode styling works (blue-400 color)
 * 7. Links work on both web and mobile platforms
 */

export const TEST_CHECKLIST = [
  '✓ External links (https://) are clickable',
  '✓ Internal links (/) navigate within app',
  '✓ Email links (mailto:) open email client',
  '✓ Phone links (tel:) open phone dialer',
  '✓ Links are styled in blue with underline',
  '✓ Dark mode shows correct blue color',
  '✓ Text without links renders normally',
  '✓ Multiple links in one text all work',
  '✓ Links work on web platform',
  '✓ Links work on iOS',
  '✓ Links work on Android',
  '✓ Long text with links wraps correctly',
  '✓ Adjacent links are distinguishable',
  '✓ Special characters in link text work',
  '✓ Query parameters in URLs work',
]
