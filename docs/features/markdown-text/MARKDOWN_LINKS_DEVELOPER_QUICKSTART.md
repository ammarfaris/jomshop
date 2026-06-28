# Markdown Links - Developer Quick Start

## 5-Minute Overview

### What It Does

Parses `[text](url)` markdown syntax and renders clickable links in contest descriptions.

### Core Component

```tsx
// packages/app/components/MarkdownText.tsx
import { MarkdownText } from 'app/components/MarkdownText'

;<MarkdownText className="text-gray-700 dark:text-gray-300">
  Submit via [our form](https://example.com/form) today!
</MarkdownText>
```

### How It Works

1. Regex matches `[text](url)` patterns
2. Splits text into parts (text + links)
3. Renders text parts as `<Text>` and link parts as `<Link>`
4. Uses Solito's `Link` for cross-platform navigation

### Regex Pattern

```typescript
;/\[([^\]]+)\]\(([^)]+)\)/g
```

Matches:

- `[` + `text` + `]` + `(` + `url` + `)`

### Where It's Used

- Entry Method & Submission
- Prizes
- Eligible Stores
- Winners Information

### Admin Forms

Blue tip box below "Entry Method & Submission" field:

```tsx
<View className="mt-1 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
  <Text className="text-xs text-blue-700 dark:text-blue-300">
    💡 Tip: You can use markdown links: [Link Text](https://example.com) or
    [Internal Link](/page)
  </Text>
</View>
```

## Quick Implementation

### Step 1: Import

```tsx
import { MarkdownText } from 'app/components/MarkdownText'
```

### Step 2: Replace Text with MarkdownText

```tsx
// Before
<Text className="text-gray-700 dark:text-gray-300">
  {contestTranslation.field_name}
</Text>

// After
<MarkdownText className="text-gray-700 dark:text-gray-300">
  {contestTranslation.field_name}
</MarkdownText>
```

### Step 3: Test

```
Input: "Visit [Google](https://google.com) today"
Output: "Visit <Link>Google</Link> today"
```

## Code Structure

```
packages/app/components/
├── MarkdownText.tsx              # Core component
└── __tests__/
    ├── MarkdownText.test.tsx     # Unit tests
    └── MarkdownText.visual.example.tsx  # Test examples

packages/app/features/
├── contest/
│   └── ContestDetailScreen.tsx   # Uses MarkdownText
└── admin/
    ├── CreateContestTabContent.tsx  # Has tip box
    └── EditContestTabContent.tsx    # Has tip box

docs/
├── MARKDOWN_LINKS_README.md           # Main guide
├── MARKDOWN_LINKS_USAGE.md            # User guide
├── MARKDOWN_LINKS_EXAMPLE.md          # Examples
├── MARKDOWN_LINKS_IMPLEMENTATION.md   # Technical details
├── MARKDOWN_LINKS_QUICK_REFERENCE.md  # Quick ref
├── MARKDOWN_LINKS_EXTENSION_GUIDE.md  # How to extend
├── MARKDOWN_LINKS_DEVELOPER_QUICKSTART.md  # This file
└── CHANGELOG_MARKDOWN_LINKS.md        # Changelog
```

## Key Points

✅ **No dependencies** - Uses existing React Native + Solito
✅ **No database changes** - Pure frontend enhancement
✅ **Backward compatible** - Works with existing data
✅ **Cross-platform** - Web, iOS, Android
✅ **Dark mode** - Automatic support
✅ **Lightweight** - ~50 lines of code

## Testing

### Manual Test

```tsx
// Copy this into admin form:
'Submit via [form](https://example.com) or check [FAQ](/faq)'

// Should render:
// "Submit via <blue-link>form</blue-link> or check <blue-link>FAQ</blue-link>"
```

### Verify

- [ ] Links are blue and underlined
- [ ] External links open in browser
- [ ] Internal links navigate in app
- [ ] Dark mode works
- [ ] Mobile works

## Common Patterns

### External Link

```
[Link Text](https://example.com)
```

### Internal Link

```
[Link Text](/page)
```

### Email

```
[Email](mailto:support@example.com)
```

### Phone

```
[Call Us](tel:+60123456789)
```

### Multiple Links

```
Visit [Site A](https://a.com) or [Site B](https://b.com)
```

## Extending to New Fields

1. Import `MarkdownText`
2. Replace `<Text>` with `<MarkdownText>`
3. Keep same className
4. Test on all platforms

See [Extension Guide](./MARKDOWN_LINKS_EXTENSION_GUIDE.md) for details.

## Troubleshooting

### Links Not Rendering

- Check import: `import { MarkdownText } from 'app/components/MarkdownText'`
- Verify component: `<MarkdownText>` not `<Text>`
- Check syntax: `[text](url)` with no spaces

### Styling Issues

- Include dark mode: `dark:text-blue-400`
- Match parent styling
- Test in both modes

### Performance

- Current implementation is fast for typical text (< 1000 chars)
- For very long text, consider memoization
- Profile if needed

## Resources

- **Main Guide:** [MARKDOWN_LINKS_README.md](./MARKDOWN_LINKS_README.md)
- **Examples:** [MARKDOWN_LINKS_EXAMPLE.md](./MARKDOWN_LINKS_EXAMPLE.md)
- **Technical:** [MARKDOWN_LINKS_IMPLEMENTATION.md](./MARKDOWN_LINKS_IMPLEMENTATION.md)
- **Extension:** [MARKDOWN_LINKS_EXTENSION_GUIDE.md](./MARKDOWN_LINKS_EXTENSION_GUIDE.md)

## Questions?

Check the docs or review the implementation in:

- `packages/app/components/MarkdownText.tsx` (~50 lines)
- `packages/app/features/contest/ContestDetailScreen.tsx` (usage examples)

---

**Time to implement:** ~5 minutes per field
**Complexity:** Low
**Risk:** None (backward compatible)
**Impact:** High (better UX)
