# Markdown Links Usage in Contest Forms

## Overview

The contest detail pages now support markdown-style links in the `entry_method_and_submission` field (and can be extended to other fields as needed).

## Syntax

Use standard markdown link syntax:

```
[Link Text](URL)
```

## Examples

### External Links

```
Submit your entry via [our contest form](https://example.com/contest-form) before the deadline.
```

```
Visit [Shopee](https://shopee.com.my) or [Lazada](https://lazada.com.my) to purchase eligible products.
```

### Internal Links

```
Read our [Terms and Conditions](/tnc) for more details.
```

```
Check out [other contests](/contests) while you're here!
```

### Multiple Links in One Text

```
Submit your proof of purchase via [the contest form](https://example.com/form) within 7 days.
For questions, visit our [FAQ page](/faq) or contact [support](mailto:support@example.com).
```

## Where It Works

Currently implemented for the following fields in contest details:

- **Entry Method & Submission** (`entry_method_and_submission`) - Main use case
- **Prizes** (`prizes`) - Link to prize details or sponsor pages
- **Eligible Stores** (`eligible_stores`) - Link to store locators or maps
- **Winners Communication Channel & Timeline** (`winners_comm_and_timeline`) - Link to winner notification details or announcement schedules
- **Winners List & Announcement** (`winners_list_and_announcement`) - Link to winner announcement pages

The admin forms (Create Contest and Edit Contest) show a helpful tip below the Entry Method field to remind admins about markdown link support.

## How to Extend to Other Fields

To add markdown link support to other text fields:

1. Import the `MarkdownText` component:

```tsx
import { MarkdownText } from 'app/components/MarkdownText'
```

2. Replace the `<Text>` component with `<MarkdownText>`:

```tsx
// Before
<Text className="text-gray-700 dark:text-gray-300">
  {contestTranslation.some_field}
</Text>

// After
<MarkdownText className="text-gray-700 dark:text-gray-300">
  {contestTranslation.some_field}
</MarkdownText>
```

## Additional Fields That Could Use Markdown Support

Consider adding markdown link support to these fields in the future:

- `eligible_products_and_purchases` - Link to product catalogs or purchase pages
- `eligible_participants` - Link to registration or verification pages
- `winners_selection_method` - Link to detailed rules or methodology pages

## Technical Details

The `MarkdownText` component:

- Parses markdown link syntax `[text](url)`
- Automatically detects internal links (starting with `/`)
- External links open in a new tab (`target="_blank"`)
- Security: External links include `rel="noopener noreferrer"`
- Uses Solito's `Link` component for cross-platform navigation
- Maintains text styling through className prop
- Works on both web and native platforms
