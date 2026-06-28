# Markdown Links - Visual Example

## Admin Form View

When creating or editing a contest, admins will see this in the "Entry Method & Submission" field:

```
┌─────────────────────────────────────────────────────────────┐
│ Entry Method & Submission (English) *                        │
├─────────────────────────────────────────────────────────────┤
│ Submit your proof of purchase via [our contest form]        │
│ (https://example.com/form) within 7 days of purchase.       │
│                                                              │
│ For more details, check our [FAQ page](/faq).               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 💡 Tip: You can use markdown links:                         │
│    [Link Text](https://example.com) or [Internal Link](/page)│
└─────────────────────────────────────────────────────────────┘
```

## User View (Contest Detail Page)

When users view the contest, they will see:

```
How to Enter
────────────

Submit your proof of purchase via our contest form within 7 days of purchase.
                                      ↑ (clickable blue link)

For more details, check our FAQ page.
                           ↑ (clickable blue link)
```

## Real-World Examples

### Example 1: E-commerce Contest

**Admin Input:**

```
Purchase any participating product worth RM50 and above from [Shopee](https://shopee.com.my/brand-store)
or [Lazada](https://lazada.com.my/brand-store). Submit your receipt via [our form](https://example.com/submit)
within 7 days. See [Terms & Conditions](/tnc) for full details.
```

**User Sees:**

- "Shopee" → links to https://shopee.com.my/brand-store
- "Lazada" → links to https://lazada.com.my/brand-store
- "our form" → links to https://example.com/submit
- "Terms & Conditions" → links to /tnc (internal navigation)

### Example 2: Social Media Contest

**Admin Input:**

```
1. Follow us on [Instagram](https://instagram.com/brand)
2. Share this post and tag 3 friends
3. Submit your entry at [contest.example.com](https://contest.example.com)

Winners will be announced on our [website](/winners) on March 1st.
```

**User Sees:**

- "Instagram" → links to https://instagram.com/brand
- "contest.example.com" → links to https://contest.example.com
- "website" → links to /winners (internal navigation)

### Example 3: Purchase-Based Contest

**Admin Input:**

```
Buy any 2 products from [participating stores](/stores) and keep your receipt.
Upload a photo of your receipt through [this form](https://forms.example.com/upload).

Need help? Contact [support@example.com](mailto:support@example.com) or visit our [Help Center](/help).
```

**User Sees:**

- "participating stores" → links to /stores (internal)
- "this form" → links to https://forms.example.com/upload
- "support@example.com" → opens email client
- "Help Center" → links to /help (internal)

## Styling

Links are styled with:

- Blue color (`text-blue-600` in light mode, `text-blue-400` in dark mode)
- Underline decoration
- Maintains the parent text's font size and line height
- Works seamlessly with the existing dark mode theme

## Cross-Platform Behavior

### Web

- Internal links navigate within the app (same tab)
- External links open in a new tab automatically
- Security: External links include `rel="noopener noreferrer"`
- Hover states show pointer cursor

### Mobile (iOS/Android)

- Internal links navigate within the app
- External links open in the device's default browser
- Tap targets are appropriately sized for touch interaction
