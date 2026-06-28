# Receipt Filename - Quick Reference Card

## Format

```
{name_prefix}_{contest_id}_{user_id}_{timestamp}.{ext}
```

## Example

```
ammar_ahmad_68f448b332e2d33ff2c4_6907b9a02675124e1798_20250109_143052.jpg
```

---

## Components

| Component | Description | Example |
|-----------|-------------|---------|
| **name_prefix** | First 2 words of name (sanitized) | `ammar_ahmad` |
| **contest_id** | Contest identifier | `68f448b332e2d33ff2c4` |
| **user_id** | User identifier | `6907b9a02675124e1798` |
| **timestamp** | `YYYYMMDD_HHMMSS` | `20250109_143052` |
| **extension** | File type | `jpg`, `png`, `pdf` |

---

## Name Sanitization

| Rule | Example |
|------|---------|
| Lowercase | `Ammar Ahmad` → `ammar_ahmad` |
| Remove apostrophes | `O'Brien` → `obrien` |
| Remove special chars | `José María` → `jos_mara` |
| Spaces → underscores | `John Smith` → `john_smith` |
| First 2 words only | `John Paul Smith` → `john_paul` |
| Single word OK | `John` → `john` |
| Fallback | `李明` → `user` |

---

## Common Edge Cases

| Input | Output Prefix |
|-------|---------------|
| `Ammar Ahmad` | `ammar_ahmad` |
| `Amarah binti Yuhan` | `amarah_binti` |
| `O'Brien Patrick` | `obrien_patrick` |
| `José María` | `jos_mara` |
| `John` | `john` |
| `Mary-Jane Watson` | `maryjane_watson` |
| `李明` | `user` |

---

## File Extensions

| MIME Type | Extension |
|-----------|-----------|
| `image/jpeg` | `jpg` |
| `image/png` | `png` |
| `image/webp` | `webp` |
| `image/heic` | `heic` |
| `application/pdf` | `pdf` |

---

## Implementation Files

```
packages/app/utils/receiptFilename.ts      ← Utility functions
packages/app/lib/receipts/api.ts           ← Upload with rename
functions/archive-receipts/index.js        ← Archive preserves name
```

---

## Key Points

✅ **Automatic** - No user action needed  
✅ **Consistent** - All files follow same pattern  
✅ **Safe** - Filesystem-compatible characters only  
✅ **Preserved** - Archive keeps original filename  
✅ **Backward Compatible** - Old files still work  

---

## Testing

```bash
# Test cases in development mode
# Check console for test results
```

---

**Quick Lookup:**
- Full docs: `FILENAME_CONVENTION.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Version: 1.0

