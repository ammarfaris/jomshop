# Cleanup Orphaned Receipts Function

## Overview

This Appwrite Function runs on a schedule to clean up orphaned receipt files - files that were uploaded but never validated (have empty permissions and no database record).

## Purpose

Orphaned files can occur in these scenarios:
1. User uploads file but network error occurs before calling validation function
2. User uploads file but closes browser before validation completes
3. Validation function fails after file upload but before permission update

Without cleanup, these files consume storage quota indefinitely.

## How It Works

1. **Fetch files** from the receipts bucket (up to 100 per execution)
2. **Identify orphaned files** - files with empty permissions older than 1 hour
3. **Verify orphans** - check that file has no corresponding database record
4. **Delete verified orphans** in batches of 10
5. **Return statistics** - files deleted, storage freed, errors

## Configuration

**Schedule**: `0 * * * *` (runs every hour at minute 0)

**Constants** (in code):
- `ORPHAN_AGE_THRESHOLD_MS`: 1 hour (3,600,000 ms)
- `MAX_FILES_TO_CHECK`: 100 files per execution
- `BATCH_SIZE`: 10 files per batch

## Response Format

### Success

```json
{
  "success": true,
  "message": "Cleaned up 5 orphaned files (2.45 MB)",
  "stats": {
    "totalFiles": 50,
    "orphanedFiles": 5,
    "verifiedOrphans": 5,
    "deletedFiles": 5,
    "deletedSizeBytes": 2569216,
    "deletedSizeMB": "2.45",
    "errors": 0,
    "errorDetails": []
  },
  "deletedFiles": [
    {
      "id": "file123",
      "name": "receipt.jpg",
      "size": 512345,
      "ageMinutes": 75
    }
  ]
}
```

### Error

```json
{
  "success": false,
  "error": "Failed to cleanup orphaned receipts",
  "errorDetails": "Error message"
}
```

## Environment Variables

Required environment variables in Appwrite Function settings:

- `APPWRITE_ENDPOINT`: Your Appwrite endpoint
- `APPWRITE_PROJECT_ID`: Your project ID
- `INTERNAL_API_KEY`: API key with the following scopes:
  - `files.read`
  - `files.write` (for deletion)
  - `documents.read` (to verify orphans)

## Deployment

### 1. Create Function in Appwrite Console

**Settings:**
- **Name**: Cleanup Orphaned Receipts
- **Runtime**: Node.js 18.0
- **Entrypoint**: index.js
- **Execute Access**: Server (API key only)
- **Schedule**: `0 * * * *` (hourly)
- **Timeout**: 60 seconds
- **Memory**: 256MB

### 2. Set Environment Variables

Add the required environment variables (see above)

### 3. Build and Deploy

```bash
cd functions/cleanup-orphaned-receipts
npm install

# Create tarball
tar --exclude='.DS_Store' --exclude='._*' -czf ../cleanup-orphaned-receipts.tar.gz .

# Upload via Appwrite Console or CLI
```

### 4. Test Manually

Trigger a manual execution from Appwrite Console to verify it works.

## Monitoring

### Key Metrics to Track

1. **Files deleted per execution** - Should be low (0-5) in normal operation
2. **Storage freed** - Total MB cleaned up
3. **Errors** - Should be 0 in normal operation
4. **Execution time** - Should complete in < 30 seconds

### Alerts to Set Up

- Alert if `deletedFiles > 10` (indicates potential issue with upload flow)
- Alert if `errors > 0` (indicates permission or API issues)
- Alert if execution fails (function timeout or crash)

### Logs to Review

Check function logs in Appwrite Console for:
- Files with DB records but no permissions (edge case - needs investigation)
- Deletion errors (permission issues)
- High orphan counts (upload flow issues)

## Safety Features

1. **Age threshold** - Only deletes files older than 1 hour (prevents deleting in-progress uploads)
2. **Database verification** - Confirms file has no DB record before deletion
3. **Batch processing** - Processes in small batches to avoid API rate limits
4. **Error handling** - Continues processing even if individual deletions fail
5. **Detailed logging** - Logs every action for audit trail

## Edge Cases Handled

### File has DB record but no permissions
- **Action**: Skip deletion (log warning)
- **Reason**: Indicates permission update failed - needs manual investigation
- **Fix**: Admin should manually update file permissions

### File is recent (< 1 hour old)
- **Action**: Skip deletion
- **Reason**: Upload may still be in progress
- **Fix**: Will be checked in next execution

### Deletion fails
- **Action**: Log error, continue with other files
- **Reason**: Permission issue or file already deleted
- **Fix**: Will retry in next execution if file still exists

## Performance

**Expected execution time:**
- 0 orphans: ~2-5 seconds
- 10 orphans: ~10-15 seconds
- 50 orphans: ~30-45 seconds

**Resource usage:**
- Memory: ~50-100 MB
- CPU: Low
- API calls: ~3 per file checked (list, verify, delete)

## Troubleshooting

### Issue: High number of orphaned files

**Possible causes:**
- Upload flow issues (network errors)
- Validation function failures
- Users abandoning uploads

**Solution:**
- Review validation function logs
- Check network error rates
- Improve upload UX (progress indicators)

### Issue: Files with DB records but no permissions

**Possible causes:**
- Permission update failed in validation function
- Race condition in validation flow

**Solution:**
- Review validation function logs
- Add retry logic to permission updates
- Manually fix affected files

### Issue: Function timeout

**Possible causes:**
- Too many files to process
- API rate limiting
- Network issues

**Solution:**
- Reduce `MAX_FILES_TO_CHECK`
- Increase `BATCH_SIZE` delay
- Increase function timeout

## Related Files

- `/packages/app/lib/receipts/api.ts` - Upload logic
- `/functions/validate-receipt-upload/index.js` - Validation function
- `/docs/features/upload-receipts/BUCKET_PERMISSIONS_ANALYSIS.md` - Security analysis

## Future Enhancements

1. **Admin dashboard** - View orphaned files before deletion
2. **Configurable threshold** - Set age threshold via environment variable
3. **Notification system** - Alert admins of high orphan counts
4. **Metrics tracking** - Store cleanup stats in database for trending
5. **Manual cleanup API** - Allow admins to trigger cleanup on demand

