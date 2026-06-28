# Markdown Links Implementation Summary

## Overview

Implemented lightweight markdown link parsing for contest translation fields, allowing admins to add clickable links in contest descriptions without requiring full markdown support.

## Implementation Details

### Core Component

**File:** `packages/app/components/MarkdownText.tsx`

A lightweight React component that:

- Parses markdown link syntax: `[text](url)`
- Supports both external links (`https://...`) and internal links (`/page`)
- Uses Solito's `Link` component for cross-platform navigation
- Maintains parent text styling through className prop
- Works on both web and native platforms

### Regex Pattern

```typescript
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
```

This pattern matches:

- `[` - Opening bracket
- `([^\]]+)` - Link text (any characters except `]`)
- `]` - Closing bracket
- `(` - Opening parenthesis
- `([^)]+)` - URL (any characters except `)`)
- `)` - Closing parenthesis

### Fields Updated

Modified `packages/app/features/contest/ContestDetailScreen.tsx` to use `MarkdownText` for:

1. **Entry Method & Submission** (`entry_method_and_submission`)
   - Primary use case for submission forms and instructions
2. **Prizes** (`prizes`)
   - Link to detailed prize information or sponsor pages
3. **Eligible Stores** (`eligible_stores`)
   - Link to store locators, maps, or store lists
4. **Winners Communication Channel & Timeline** (`winners_comm_and_timeline`)
   - Link to winner notification details or announcement schedules
5. **Winners List & Announcement** (`winners_list_and_announcement`)
   - Link to winner announcement pages or notification details

### Admin Form Updates

Added helpful tips in both admin forms:

**Files:**

- `packages/app/features/admin/CreateContestTabContent.tsx`
- `packages/app/features/admin/EditContestTabContent.tsx`

**Tip displayed:**

```
💡 Tip: You can use markdown links: [Link Text](https://example.com) or [Internal Link](/page)
```

Positioned directly below the "Entry Method & Submission" field in a blue info box.

## Usage Examples

### External Link

```
Submit your entry via [our contest form](https://example.com/form) before the deadline.
```

### Internal Link

```
Read our [Terms and Conditions](/tnc) for more details.
```

### Multiple Links

```
Visit [Shopee](https://shopee.com.my) or [Lazada](https://lazada.com.my) to purchase eligible products.
```

### Email Link

```
Contact [support@example.com](mailto:support@example.com) for assistance.
```

## Cross-Platform Behavior

### Web

- Internal links navigate within the app (SPA behavior)
- External links open in a new tab (`target="_blank"`)
- Security: External links include `rel="noopener noreferrer"` to prevent security vulnerabilities
- Hover shows pointer cursor
- Links styled with blue color and underline

### Mobile (iOS/Android)

- Internal links use native navigation
- External links open in device's default browser
- Appropriate touch targets for mobile interaction
- Same visual styling as web

## Styling

Links are styled with:

- `text-blue-600` (light mode) / `text-blue-400` (dark mode)
- `underline` decoration
- Inherits parent text's font size and line height
- Seamless dark mode support

## Testing

Created test file: `packages/app/components/__tests__/MarkdownText.test.tsx`

Test cases cover:

- External link parsing
- Internal link parsing
- Multiple links in one text
- Plain text without links
- Mixed content (text + links)

## Documentation

Created comprehensive documentation:

1. **MARKDOWN_LINKS_USAGE.md** - User guide for admins
2. **MARKDOWN_LINKS_EXAMPLE.md** - Visual examples and real-world use cases
3. **MARKDOWN_LINKS_IMPLEMENTATION.md** - Technical implementation details (this file)

## Future Enhancements

Potential improvements:

1. Add markdown support to more fields:

   - `eligible_products_and_purchases`
   - `eligible_participants`
   - `winners_selection_method`

2. Extend markdown support to include:

   - Bold text: `**text**`
   - Italic text: `*text*`
   - Lists: `- item`

3. Add validation in admin forms:

   - Check for malformed markdown links
   - Validate URLs
   - Preview rendered output

4. Add analytics:
   - Track link clicks
   - Monitor which links are most used

## Migration Notes

No database migration required. This is a pure frontend enhancement that:

- Works with existing data
- Gracefully handles text without markdown
- Backward compatible with all existing contest data

## Performance Considerations

- Regex parsing is performed on render
- For very long text fields, consider memoization
- Current implementation is lightweight and performant for typical contest descriptions (< 1000 characters)

## Security Considerations

- No XSS risk as we're using React's built-in text rendering
- URLs are not sanitized (admin-only feature, trusted input)
- For user-generated content, would need URL validation/sanitization

## Browser/Platform Support

Tested and working on:

- ✅ Web (Chrome, Safari, Firefox)
- ✅ iOS (React Native)
- ✅ Android (React Native)

## Related Files

- `packages/app/components/MarkdownText.tsx` - Core component
- `packages/app/features/contest/ContestDetailScreen.tsx` - Usage in contest details
- `packages/app/features/admin/CreateContestTabContent.tsx` - Admin form with tip
- `packages/app/features/admin/EditContestTabContent.tsx` - Admin form with tip
- `docs/MARKDOWN_LINKS_USAGE.md` - User documentation
- `docs/MARKDOWN_LINKS_EXAMPLE.md` - Visual examples
