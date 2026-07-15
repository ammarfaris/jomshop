# Markdown Links Feature - Complete Guide

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Implementation](#implementation)
3. [Testing](#testing)
4. [Support](#support)

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

✅ External links (`http://` / `https://`)
✅ Internal links (`/page`, `./page`, `../page`, `#anchor`)
✅ Multiple links in one text
✅ Unsafe schemes are blocked (`javascript:`, `data:`, `mailto:`, `tel:` render as plain text)
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
- ✓ Unsafe schemes render as plain text (not clickable)
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
A: External links must start with `http://` or `https://`. Relative links must start with `/`, `./`, `../`, or `#`.

**Q: Internal link not working?**
A: Ensure the path starts with `/` (e.g., `/tnc` not `tnc`).

### Getting Help

See the component source and tests:
`packages/app/components/MarkdownText.tsx`,
`packages/app/components/__tests__/MarkdownText.test.tsx`

## 🔮 Future Enhancements

Potential improvements:

- Add more markdown features (bold, italic, lists)
- Expand allowlist if additional safe protocols are needed
- Add preview mode
- Extend to more fields
- Track link click analytics

## 📝 Notes

- No database changes required
- Fully backward compatible
- Works with existing contest data
- Defense in depth: only `http(s)` and relative links are rendered as clickable
- Cross-platform support

## 🎉 Quick Win

This feature provides immediate value:

- ✨ Better user experience with clickable links
- ✨ No training required (familiar markdown syntax)
- ✨ No data migration needed
- ✨ Works across all platforms
- ✨ Maintains existing styling

---

**Last Updated:** 2026
**Status:** ✅ Production Ready
**Platforms:** Web, iOS, Android
