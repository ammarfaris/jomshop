# Archive Receipts Storage Transfer Fix

## Problem Summary

When unsaving a contest with receipts:
- ✅ Archive database records were created correctly in `usersReceiptsArchive`
- ❌ Files were NOT transferred to `usersReceiptsArchiveBucket` storage
- ❌ Original files remained in `690d9d55003242e2a2b1` (Users Receipts Bucket)

This resulted in:
- Archive documents pointing to non-existent files
- Original files not being cleaned up (orphaned files)
- Storage quota being wasted

**This was working correctly in previous commits but broke recently.**

## Root Cause

The `archive-receipts` function had **critical missing code**:

### What It Was Doing (Broken)
```javascript
// Download file from main bucket ✅
const fileBuffer = await response.arrayBuffer()
const buffer = Buffer.from(fileBuffer)

// Write to temp file ✅
fs.writeFileSync(tempFilePath, buffer)

// Create InputFile ✅
const inputFile = InputFile.fromPath(tempFilePath, fileName)

// ❌ MISSING: Upload to archive bucket - IT SKIPPED THIS ENTIRELY!

// Create archive document with NEW file_id ✅
await tablesDB.createRow({...})

// ❌ MISSING: Delete original file from main bucket
```

### What It Should Do (Fixed)
```javascript
// Download file from main bucket ✅
const fileBuffer = await response.arrayBuffer()
const buffer = Buffer.from(fileBuffer)

// Write to temp file ✅
fs.writeFileSync(tempFilePath, buffer)

// Create InputFile ✅
const inputFile = InputFile.fromPath(tempFilePath, fileName)

// ✅ FIX 1: Upload to archive bucket
await storage.createFile(
  USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
  newFileId,
  inputFile,
  []
)

// Create archive document with NEW file_id ✅
await tablesDB.createRow({...})

// ✅ FIX 2: Delete original file from main bucket
await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, originalFileId)
```

## Solution Details

### Fix 1: Upload to Archive Bucket
```javascript
// ⚡ CRITICAL FIX: Actually upload file to archive bucket
log(`Uploading file to archive bucket: ${newFileId}`)
await storage.createFile(
  USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
  newFileId,
  inputFile,
  [] // No permissions - admin only access
)
log(`✅ File uploaded to archive bucket: ${newFileId}`)

// Track for potential rollback
uploadedArchiveFiles.push({ fileId: newFileId, originalFileId: receipt.file_id })
```

### Fix 2: Delete Original File
```javascript
// ⚡ CRITICAL FIX: Delete original file from main bucket
log(`Deleting original file from main bucket: ${receipt.file_id}`)
await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, receipt.file_id)
log(`✅ Original file deleted from main bucket: ${receipt.file_id}`)
```

### Fix 3: Rollback Protection
```javascript
// Clean up any files that were uploaded to archive bucket
if (uploadedArchiveFiles.length > 0) {
  log(`Rolling back ${uploadedArchiveFiles.length} uploaded archive files...`)
  for (const { fileId } of uploadedArchiveFiles) {
    try {
      await storage.deleteFile(USERS_RECEIPTS_ARCHIVE_BUCKET_ID, fileId)
      log(`Cleaned up archive file: ${fileId}`)
    } catch (cleanupErr) {
      error(`Failed to cleanup archive file ${fileId}: ${cleanupErr.message}`)
    }
  }
}
```

## What Was Lost Before This Fix

If you unsaved contests with receipts **before this fix was deployed**, you have:

1. **Archive Database Records**: ✅ Exist in `usersReceiptsArchive`
   - But point to file_ids that don't exist in archive bucket
   
2. **Original Files**: ❌ Still in `690d9d55003242e2a2b1`
   - Taking up storage space
   - No longer accessible to users (documents deleted)
   - Need manual cleanup

3. **Archive Bucket Files**: ❌ Empty
   - Should contain the archived files but doesn't

### Recovery Options

**Option A: Re-archive Orphaned Files** (Recommended)
```javascript
// Create a one-time migration script to:
// 1. Find archive documents with missing files
// 2. Check if original files still exist in main bucket
// 3. Copy them to archive bucket with the correct file_id
// 4. Delete from main bucket
```

**Option B: Clean Up Only** (If files no longer needed)
```javascript
// 1. Find orphaned files in main bucket
// 2. Delete them to free up storage
// 3. Mark archive documents as "file_missing"
```

## Deployment

### 1. Package the Fixed Function

```bash
cd functions/archive-receipts
tar --exclude='.DS_Store' --exclude='._*' -czf ../archive-receipts.tar.gz .
```

### 2. Deploy to Appwrite

1. Go to Appwrite Console → Functions
2. Find function `archive-receipts` (ID: `69082cb4000e24d3e9b1`)
3. Click "Create Deployment"
4. Upload `archive-receipts.tar.gz`
5. Set Entrypoint: `index.js`
6. Click "Deploy"

### 3. Verify Deployment

Check that the function has all required environment variables:
```
APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=690692a70013e62b8075
INTERNAL_API_KEY=<your-api-key>
DATABASE_ID=6859b128002afc56c476
USERS_RECEIPTS_COLLECTION_ID=usersReceipts
USERS_RECEIPTS_BUCKET_ID=690d9d55003242e2a2b1
USERS_RECEIPTS_ARCHIVE_COLLECTION_ID=usersReceiptsArchive
USERS_RECEIPTS_ARCHIVE_BUCKET_ID=usersReceiptsArchiveBucket
```

### 4. Test the Fix

**Test Scenario**: Unsave a contest with receipts

1. Save a contest and upload 1-2 receipts
2. Unsave the contest
3. Check that:
   - ✅ Archive documents created in `usersReceiptsArchive`
   - ✅ Files appear in `usersReceiptsArchiveBucket`
   - ✅ Original files deleted from `690d9d55003242e2a2b1`
   - ✅ Original documents deleted from `usersReceipts`

**Verification Query** (Appwrite Console → Database):
```
Collection: usersReceiptsArchive
Filter: archived_reason = "Contest unsaved by user"
Order: $createdAt DESC
Limit: 5
```

For each document, verify:
- `file_id` exists in archive bucket (check Storage)
- Original file_id NOT in main bucket

## What To Look For In Logs

**Success Pattern**:
```
Downloading file [file_id]
File buffer size: [bytes] bytes
Uploading file to archive bucket: [new_file_id]
✅ File uploaded to archive bucket: [new_file_id]
Temp file deleted: [temp_path]
Staging original document deletion in transaction
Deleting original file from main bucket: [original_file_id]
✅ Original file deleted from main bucket: [original_file_id]
✅ Transaction committed successfully - all receipts archived atomically
```

**Rollback Pattern** (if error occurs):
```
Critical error during archiving: [error_message]
Transaction rolled back due to critical error
Rolling back [count] uploaded archive files...
Cleaned up archive file: [file_id]
```

## Storage Impact

### Before Fix
- Main bucket: Growing unnecessarily (orphaned files)
- Archive bucket: Empty (no files transferred)
- Storage waste: ~100% of archived receipts

### After Fix
- Main bucket: Only active receipts
- Archive bucket: All archived receipts
- Storage optimization: Proper separation

## Related Files Changed

- `functions/archive-receipts/index.js` - Main fix (3 critical additions)
- `docs/fixes/ARCHIVE_RECEIPTS_STORAGE_FIX.md` - This documentation

## Notes

- The fix includes automatic rollback if archiving fails
- Files are transferred atomically (all or none)
- Transaction ensures database consistency
- No changes needed to client code
- Works with existing UI (SaveButton confirmation dialog)

## Why This Worked Before

Looking at git history, this was likely broken during a refactoring where:
1. The storage upload code was accidentally removed
2. The original file deletion was missed
3. Tests only checked database records, not actual files
4. Manual testing didn't verify storage bucket contents

**Lesson**: Always verify storage bucket contents, not just database records.

