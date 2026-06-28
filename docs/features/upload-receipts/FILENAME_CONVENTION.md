# Receipt Filename Convention

## Overview

All receipt files uploaded to the User Receipts Bucket are automatically renamed to follow a standardized naming convention. This ensures consistent file organization and easy identification.

## Filename Format

```
{name_prefix}_{contest_id}_{user_id}_{timestamp}.{extension}
```

### Components

1. **name_prefix** - First two words of user's name (or full name if less than 2 words)
2. **contest_id** - Contest identifier
3. **user_id** - User identifier
4. **timestamp** - Upload timestamp in format `YYYYMMDD_HHMMSS`
5. **extension** - File extension (jpg, png, pdf, etc.)

### Example

```
ammar_ahmad_68f448b332e2d33ff2c4_6907b9a02675124e1798_20250109_143052.jpg
```

**Breakdown:**
- `ammar_ahmad` - User name (first two words)
- `68f448b332e2d33ff2c4` - Contest ID
- `6907b9a02675124e1798` - User ID
- `20250109_143052` - Timestamp (Jan 9, 2025 at 14:30:52)
- `jpg` - File extension

---

## Name Sanitization Rules

The `name_prefix` is sanitized to ensure filesystem compatibility:

### 1. **Lowercase Conversion**
All characters converted to lowercase
```
"Ammar Ahmad" → "ammar_ahmad"
```

### 2. **Apostrophe Removal**
Apostrophes and backticks are removed
```
"O'Brien Patrick" → "obrien_patrick"
"Amarah binti Yuhan" → "amarah_binti"
```

### 3. **Special Character Removal**
Non-alphanumeric characters (except spaces) are removed
```
"José María" → "jos_mara"
"Mary-Jane Watson" → "maryjane_watson"
```

### 4. **Space to Underscore**
Spaces replaced with underscores
```
"John Smith" → "john_smith"
```

### 5. **Multiple Underscores**
Consecutive underscores replaced with single underscore
```
"John  Smith" → "john_smith" (not "john__smith")
```

### 6. **Trim Underscores**
Leading/trailing underscores removed
```
"_John_" → "john"
```

---

## Edge Cases Handled

### Case 1: Names with "binti" or "bin"

```
Input:  "Amarah binti Yuhan"
Output: amarah_binti_68f448...20250109_143052.jpg
```

**Note:** Takes first two words, which includes "binti"

### Case 2: Names with Apostrophes

```
Input:  "O'Brien Patrick"
Output: obrien_patrick_68f448...20250109_143052.jpg
```

**Note:** Apostrophe removed, name flows naturally

### Case 3: Single Word Names

```
Input:  "John"
Output: john_68f448...20250109_143052.jpg
```

**Note:** Uses full name when less than 2 words

### Case 4: Hyphenated Names

```
Input:  "Mary-Jane Watson"
Output: maryjane_watson_68f448...20250109_143052.jpg
```

**Note:** Hyphen removed, words joined

### Case 5: Accented Characters

```
Input:  "José María García"
Output: jos_mara_68f448...20250109_143052.jpg
```

**Note:** Accents removed (non-ASCII characters)

### Case 6: Non-Latin Characters

```
Input:  "李明"
Output: user_68f448...20250109_143052.jpg
```

**Note:** Falls back to "user" when no valid characters remain

### Case 7: Empty or Invalid Names

```
Input:  "" or "!!!" or "###"
Output: user_68f448...20250109_143052.jpg
```

**Note:** Falls back to "user" for safety

---

## File Extension Mapping

Extensions are determined from MIME types:

| MIME Type | Extension |
|-----------|-----------|
| `image/jpeg` | `jpg` |
| `image/jpg` | `jpg` |
| `image/png` | `png` |
| `image/webp` | `webp` |
| `image/heic` | `heic` |
| `image/heif` | `heif` |
| `application/pdf` | `pdf` |

**Fallback:** If MIME type not recognized, extracts extension from original filename, or uses `bin` as last resort.

---

## Timestamp Format

Format: `YYYYMMDD_HHMMSS`

- **YYYY** - 4-digit year (e.g., 2025)
- **MM** - 2-digit month (01-12)
- **DD** - 2-digit day (01-31)
- **HH** - 2-digit hour (00-23, 24-hour format)
- **MM** - 2-digit minute (00-59)
- **SS** - 2-digit second (00-59)

**Example:** `20250109_143052` = January 9, 2025 at 2:30:52 PM

---

## Implementation Details

### Client-Side (Upload)

**File:** `packages/app/lib/receipts/api.ts`

```typescript
// Generate standardized filename before upload
const standardizedFilename = generateReceiptFilename(
  userName,
  contestId,
  userId,
  fileType,
  file.name
)

// Create file with new name
const fileToUpload = new File([file], standardizedFilename, {
  type: file.type || fileType,
})

// Upload to storage
const uploadedFile = await storage.createFile(
  USERS_RECEIPTS_BUCKET_ID,
  'unique()',
  fileToUpload,
  []
)
```

### Archive Function (Preservation)

**File:** `functions/archive-receipts/index.js`

```javascript
// Get original filename from storage
const originalFile = await storage.getFile(
  USERS_RECEIPTS_BUCKET_ID,
  receipt.file_id
)
const originalFilename = originalFile.name

// Preserve filename when archiving
const inputFile = InputFile.fromPath(
  tempFilePath,
  originalFilename  // ← Same filename preserved
)

await storage.createFile(
  USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
  newFileId,
  inputFile,
  []
)
```

---

## Benefits of Standardized Naming

### 1. **Easy Identification**
Filename contains all key information without database lookup

### 2. **Consistent Organization**
All files follow same pattern, easier to manage

### 3. **Searchable**
Can search by user name, contest ID, or date

### 4. **Audit Trail**
Timestamp embedded in filename for tracking

### 5. **Filesystem Safe**
No special characters that could cause issues

### 6. **Archive Preservation**
Original filename retained when archiving

---

## Testing

### Test Cases Included

The utility includes built-in test cases for development:

```typescript
const testCases = [
  { name: 'Ammar Ahmad', expected: 'ammar_ahmad' },
  { name: "Amarah binti Yuhan", expected: 'amarah_binti' },
  { name: "O'Brien Patrick", expected: 'obrien_patrick' },
  { name: 'José María García', expected: 'jos_mara' },
  { name: 'John', expected: 'john' },
  { name: 'Mary-Jane Watson', expected: 'maryjane_watson' },
  { name: '李明', expected: 'user' },
]
```

**Run tests:** Tests automatically run in development mode (`__DEV__`)

---

## File Locations

### Utility Functions
- `packages/app/utils/receiptFilename.ts` - Filename generation utilities

### Upload Implementation
- `packages/app/lib/receipts/api.ts` - Client-side upload with renaming

### Archive Implementation
- `functions/archive-receipts/index.js` - Server-side archive with preservation

---

## Migration Notes

### Existing Files

Files uploaded before this feature was implemented will retain their original names. Only new uploads will use the standardized naming convention.

### Archive Behavior

When archiving receipts:
1. Original filename is retrieved from storage metadata
2. Same filename is used in archive bucket
3. No timestamp changes occur during archiving

---

## Troubleshooting

### Issue: Filename shows "user" instead of name

**Cause:** User name contains only non-Latin characters or special characters

**Solution:** This is expected behavior. The system falls back to "user" for safety.

### Issue: Name truncated to one word

**Cause:** User has single-word name

**Solution:** This is expected. System uses full name when less than 2 words.

### Issue: Archived file has different name

**Cause:** Archive function bug (should not happen with current implementation)

**Solution:** Check archive function logs, ensure `originalFile.name` is being used.

---

## Future Enhancements

### Potential Improvements

1. **Unicode Support** - Better handling of non-Latin characters
2. **Name Variations** - Support for different name formats (Last, First)
3. **Custom Prefixes** - Allow users to set custom filename prefixes
4. **Bulk Rename** - Tool to rename existing files to new convention

---

## Related Documentation

- [Why User CREATE Permission Needed](./WHY_USER_CREATE_PERMISSION_NEEDED.md)
- [Archive Bucket Permissions](./ARCHIVE_BUCKET_NO_USER_PERMISSIONS.md)
- [Receipt Upload Flow](../upload-receipts/)

---

**Last Updated:** 2025-01-09  
**Status:** ✅ Implemented and tested  
**Version:** 1.0

