# Extending Markdown Links to Additional Fields

## Overview

This guide explains how to add markdown link support to additional contest translation fields beyond the currently implemented ones.

## Currently Implemented Fields

✅ Entry Method & Submission (`entry_method_and_submission`)
✅ Prizes (`prizes`)
✅ Eligible Stores (`eligible_stores`)
✅ Winners Communication Channel & Timeline (`winners_comm_and_timeline`)
✅ Winners List & Announcement (`winners_list_and_announcement`)

## Step-by-Step Guide

### Step 1: Identify the Field

Choose a field from the `contestTranslations` table that would benefit from markdown links:

**Good candidates:**

- `eligible_products_and_purchases` - Link to product catalogs
- `eligible_participants` - Link to registration pages
- `winners_selection_method` - Link to methodology details

**Less suitable:**

- Short fields (< 50 characters)
- Fields that are rarely used
- Fields with structured data (use dedicated UI instead)

### Step 2: Update ContestDetailScreen.tsx

**Location:** `packages/app/features/contest/ContestDetailScreen.tsx`

**Find the field rendering:**

```tsx
<Text className="text-gray-700 dark:text-gray-300 leading-relaxed">
  {contestTranslation.field_name}
</Text>
```

**Replace with:**

```tsx
<MarkdownText className="text-gray-700 dark:text-gray-300 leading-relaxed">
  {contestTranslation.field_name}
</MarkdownText>
```

**Example:**

```tsx
// Before
{
  contestTranslation?.eligible_products_and_purchases && (
    <View>
      <Text className="text-lg font-semibold text-black dark:text-white mb-2">
        Eligible Products
      </Text>
      <Text className="text-gray-700 dark:text-gray-300 leading-relaxed">
        {contestTranslation.eligible_products_and_purchases}
      </Text>
    </View>
  )
}

// After
{
  contestTranslation?.eligible_products_and_purchases && (
    <View>
      <Text className="text-lg font-semibold text-black dark:text-white mb-2">
        Eligible Products
      </Text>
      <MarkdownText className="text-gray-700 dark:text-gray-300 leading-relaxed">
        {contestTranslation.eligible_products_and_purchases}
      </MarkdownText>
    </View>
  )
}
```

### Step 3: Add Tip to Admin Forms (Optional)

If the field is commonly used and would benefit from a reminder, add a tip box.

**Location:**

- `packages/app/features/admin/CreateContestTabContent.tsx`
- `packages/app/features/admin/EditContestTabContent.tsx`

**Find the field rendering:**

```tsx
{
  renderLocaleFieldPair(
    'field_name_en',
    'field_name_ms',
    'Field Label',
    'Placeholder EN',
    'Placeholder MS',
    'textarea',
    true
  )
}
```

**Add tip below:**

```tsx
{
  renderLocaleFieldPair(
    'field_name_en',
    'field_name_ms',
    'Field Label',
    'Placeholder EN',
    'Placeholder MS',
    'textarea',
    true
  )
}
;<View className="mt-1 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
  <Text className="text-xs text-blue-700 dark:text-blue-300">
    💡 Tip: You can use markdown links: [Link Text](https://example.com) or
    [Internal Link](/page)
  </Text>
</View>
```

### Step 4: Update Documentation

**Update:** `docs/MARKDOWN_LINKS_USAGE.md`

Add the new field to the "Where It Works" section:

```markdown
## Where It Works

Currently implemented for the following fields in contest details:

- **Entry Method & Submission** (`entry_method_and_submission`)
- **Prizes** (`prizes`)
- **Eligible Stores** (`eligible_stores`)
- **Winners List and Announcement** (`winners_list_and_announcement`)
- **[NEW FIELD NAME]** (`field_name`) - [Description]
```

### Step 5: Test

1. **Create a test contest** with markdown links in the new field
2. **Verify rendering** on contest detail page
3. **Test links** - click to ensure they work
4. **Test platforms** - verify on web, iOS, and Android
5. **Test dark mode** - ensure styling is correct

### Step 6: Update Changelog

**Update:** `docs/CHANGELOG_MARKDOWN_LINKS.md`

Add an entry:

```markdown
### [Date] - Extended to [Field Name]

- Added markdown link support to `field_name`
- Updated ContestDetailScreen.tsx
- Added tip to admin forms (if applicable)
- Updated documentation
```

## Complete Example

Let's add markdown support to `eligible_products_and_purchases`:

### 1. Update ContestDetailScreen.tsx

```tsx
// Find this section (around line 980-990)
{
  contestTranslation?.eligible_products_and_purchases && (
    <View>
      <Trans>
        <Text className="text-base font-semibold text-black dark:text-white mb-2">
          Eligible Products & Purchases
        </Text>
      </Trans>
      <Text className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {contestTranslation.eligible_products_and_purchases}
      </Text>
    </View>
  )
}

// Change to:
{
  contestTranslation?.eligible_products_and_purchases && (
    <View>
      <Trans>
        <Text className="text-base font-semibold text-black dark:text-white mb-2">
          Eligible Products & Purchases
        </Text>
      </Trans>
      <MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {contestTranslation.eligible_products_and_purchases}
      </MarkdownText>
    </View>
  )
}
```

### 2. Add Tip to Admin Forms

In both `CreateContestTabContent.tsx` and `EditContestTabContent.tsx`:

```tsx
// Find the eligible_products field rendering
{
  renderLocaleFieldPair(
    'eligible_products_en',
    'eligible_products_ms',
    'Eligible Products & Purchases',
    'Products that qualify...',
    'Produk yang layak...',
    'textarea',
    true
  )
}

// Add tip below:
;<View className="mt-1 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
  <Text className="text-xs text-blue-700 dark:text-blue-300">
    💡 Tip: You can use markdown links: [Link Text](https://example.com) or
    [Internal Link](/page)
  </Text>
</View>
```

### 3. Test

Create a contest with:

```
Purchase any product from [our catalog](https://example.com/catalog) worth RM50 and above.
See [product list](/products) for details.
```

Verify:

- ✓ "our catalog" links to https://example.com/catalog
- ✓ "product list" links to /products
- ✓ Links are blue and underlined
- ✓ Works on web and mobile

## Best Practices

### When to Add Markdown Support

✅ **Good candidates:**

- Fields with external references (forms, websites, stores)
- Fields that commonly need links
- Long-form text fields (> 100 characters)
- Fields that reference other pages

❌ **Avoid:**

- Very short fields (< 50 characters)
- Structured data fields
- Fields with specific formatting requirements
- Rarely used fields

### Styling Consistency

Always use the same className pattern:

```tsx
<MarkdownText className="text-gray-700 dark:text-gray-300 leading-relaxed">
```

Or for smaller text:

```tsx
<MarkdownText className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
```

### Testing Checklist

- [ ] Links render correctly
- [ ] External links open in browser
- [ ] Internal links navigate within app
- [ ] Dark mode styling works
- [ ] Mobile platforms work
- [ ] Text without links renders normally
- [ ] Multiple links work
- [ ] Long text wraps correctly

## Troubleshooting

### Links Not Rendering

**Problem:** Text shows `[text](url)` instead of a link

**Solution:**

1. Verify `MarkdownText` is imported
2. Check component is used (not `Text`)
3. Verify syntax is correct

### Styling Issues

**Problem:** Links don't match design

**Solution:**

1. Check className includes dark mode variants
2. Verify parent container styling
3. Test in both light and dark modes

### Performance Issues

**Problem:** Slow rendering with very long text

**Solution:**

1. Consider memoization for long fields
2. Limit field length in schema
3. Profile render performance

## Rollback

If issues occur, rollback is simple:

1. Replace `<MarkdownText>` with `<Text>`
2. Remove tip boxes from admin forms
3. Update documentation

No data changes needed.

## Questions?

See:

- [Implementation Details](./MARKDOWN_LINKS_IMPLEMENTATION.md)
- [Usage Guide](./MARKDOWN_LINKS_USAGE.md)
- [Examples](./MARKDOWN_LINKS_EXAMPLE.md)
