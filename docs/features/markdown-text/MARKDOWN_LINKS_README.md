# Markdown Links Feature - Complete Guide

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Documentation](#documentation)
3. [Implementation](#implementation)
4. [Testing](#testing)
5. [Support](#support)

## 🚀 Quick Start

### For Admins

When creating or editing contests, you can now use markdown links in these fields:

- Entry Method & Submission
- Prizes
- Eligible Stores
- Winners Information

**Syntax:**

```
[Link Text](URL)
```

**Example:**

```
Submit your entry via [our contest form](https://example.com/form) before the deadline.
```

See the blue tip box below the "Entry Method & Submission" field in the admin panel for a quick reminder.

### For Developers

Import and use the `MarkdownText` component:

```tsx
import { MarkdownText } from 'app/components/MarkdownText'

;<MarkdownText className="text-gray-700 dark:text-gray-300">
  {contestTranslation.entry_method_and_submission}
</MarkdownText>
```

## 📚 Documentation

### User Guides

- **[MARKDOWN_LINKS_USAGE.md](./MARKDOWN_LINKS_USAGE.md)** - Complete usage guide with syntax and examples
- **[MARKDOWN_LINKS_EXAMPLE.md](./MARKDOWN_LINKS_EXAMPLE.md)** - Visual examples and real-world use cases
- **[MARKDOWN_LINKS_QUICK_REFERENCE.md](./MARKDOWN_LINKS_QUICK_REFERENCE.md)** - Quick reference card for admins

### Technical Documentation

- **[MARKDOWN_LINKS_IMPLEMENTATION.md](./MARKDOWN_LINKS_IMPLEMENTATION.md)** - Technical implementation details
- **[CHANGELOG_MARKDOWN_LINKS.md](./CHANGELOG_MARKDOWN_LINKS.md)** - Complete changelog

## 🔧 Implementation

### Core Component

**Location:** `packages/app/components/MarkdownText.tsx`

A lightweight React component that parses markdown link syntax and renders clickable links using Solito's cross-platform `Link` component.

### Modified Files

1. **Contest Detail Screen**

   - `packages/app/features/contest/ContestDetailScreen.tsx`
   - Updated 4 fields to use `MarkdownText` component

2. **Admin Forms**
   - `packages/app/features/admin/CreateContestTabContent.tsx`
   - `packages/app/features/admin/EditContestTabContent.tsx`
   - Added helpful tip boxes

### Features

✅ External links (`https://example.com`)
✅ Internal links (`/page`)
✅ Email links (`mailto:email@example.com`)
✅ Phone links (`tel:+60123456789`)
✅ Multiple links in one text
✅ Cross-platform (Web, iOS, Android)
✅ Dark mode support
✅ Backward compatible

## 🧪 Testing

### Manual Testing

Use the examples in:

- `packages/app/components/__tests__/MarkdownText.visual.example.tsx`

Copy and paste these examples into the admin forms to verify rendering.

### Test Checklist

- ✓ External links are clickable
- ✓ Internal links navigate within app
- ✓ Email links open email client
- ✓ Links are styled correctly (blue, underlined)
- ✓ Dark mode works
- ✓ Works on web, iOS, and Android
- ✓ Text without links renders normally

### Automated Tests

Basic test structure in:

- `packages/app/components/__tests__/MarkdownText.test.tsx`

## 🎯 Use Cases

### E-commerce Contests

```
Purchase from [Shopee](https://shopee.com.my/store) or [Lazada](https://lazada.com.my/store).
Submit receipt via [our form](https://example.com/submit).
```

### Social Media Contests

```
Follow us on [Instagram](https://instagram.com/brand) and submit at [contest.example.com](https://contest.example.com).
```

### Purchase-Based Contests

```
Buy from [participating stores](/stores) and upload receipt through [this form](https://forms.example.com/upload).
```

## 📖 Examples

### Basic External Link

```
Visit [our website](https://example.com) for more information.
```

**Renders:** Visit <u style="color: blue;">our website</u> for more information.

### Basic Internal Link

```
Read our [Terms and Conditions](/tnc) before entering.
```

**Renders:** Read our <u style="color: blue;">Terms and Conditions</u> before entering.

### Multiple Links

```
Shop at [Shopee](https://shopee.com.my) or [Lazada](https://lazada.com.my).
```

**Renders:** Shop at <u style="color: blue;">Shopee</u> or <u style="color: blue;">Lazada</u>.

## 🆘 Support

### Common Issues

**Q: Links not rendering?**
A: Check syntax - must be exactly `[text](url)` with no spaces.

**Q: Link not clickable?**
A: Verify the URL is complete (include `https://` for external links).

**Q: Internal link not working?**
A: Ensure the path starts with `/` (e.g., `/tnc` not `tnc`).

### Getting Help

1. Check the [Quick Reference](./MARKDOWN_LINKS_QUICK_REFERENCE.md)
2. Review [Examples](./MARKDOWN_LINKS_EXAMPLE.md)
3. See [Implementation Details](./MARKDOWN_LINKS_IMPLEMENTATION.md)

## 🔮 Future Enhancements

Potential improvements:

- Add more markdown features (bold, italic, lists)
- Add link validation in admin forms
- Add preview mode
- Extend to more fields
- Track link click analytics

## 📝 Notes

- No database changes required
- Fully backward compatible
- Works with existing contest data
- Admin-only feature (trusted input)
- Cross-platform support

## 🎉 Quick Win

This feature provides immediate value:

- ✨ Better user experience with clickable links
- ✨ No training required (familiar markdown syntax)
- ✨ No data migration needed
- ✨ Works across all platforms
- ✨ Maintains existing styling

---

**Last Updated:** 2024
**Status:** ✅ Production Ready
**Platforms:** Web, iOS, Android
