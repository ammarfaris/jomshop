# Archive Receipts Function

## Overview

This function archives receipts when a user unsaves a contest. It moves receipts and their files from active storage to archive storage with admin-only access.

## Environment Variables

Required environment variables (set in Appwrite Console):

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

All collection and bucket IDs have defaults but can be overridden via environment variables.

## Input

```json
{
  "receiptIds": ["receipt_id_1", "receipt_id_2"],
  "contestId": "contest_id",
  "userId": "user_id",
  "jwtToken": "user_jwt_token_here",
  "reason": "Contest unsaved by user"
}
```

## Output

```json
{
  "success": true,
  "archivedCount": 2,
  "errors": [],
  "total": 2
}
```

## Process

1. **Validate** - Checks receipt ownership
2. **Download** - Gets files from main bucket (server has access)
3. **Upload** - Moves files to archive bucket
4. **Create** - Creates archive documents
5. **Delete** - Removes original files and documents

## Security

- ✅ **JWT Authentication**: Validates user's JWT token before processing
- ✅ **User Verification**: Ensures `userId` matches authenticated user from JWT
- ✅ **Receipt Ownership**: Validates user owns each receipt before archiving
- ✅ **Archive Isolation**: Archive resources have NO user permissions (admin only)
- ✅ **Audit Trail**: All operations logged with user context
- ✅ Rollback on failure (partial archives logged)

## Deployment

### 1. Create tar.gz

```bash
cd functions/archive-receipts
tar --exclude='.DS_Store' --exclude='._*' -czf ../archive-receipts.tar.gz .
```

### 2. Upload to Appwrite Console

- Go to Functions → Create Function
- Name: `archive-receipts`
- Runtime: Node.js 18.0
- Upload: `archive-receipts.tar.gz`

### 3. Set Environment Variables

Add the required environment variables listed above.

### 4. Update Constant

Copy the function ID and update in `packages/app/provider/appwrite/constants.ts`:

```typescript
export const ARCHIVE_RECEIPTS_FUNCTION_ID = 'YOUR_FUNCTION_ID'
```

## Testing

Test via Appwrite Console or API:

```bash
curl -X POST https://sgp.cloud.appwrite.io/v1/functions/YOUR_FUNCTION_ID/executions \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptIds": ["test_receipt_id"],
    "contestId": "test_contest_id",
    "userId": "test_user_id",
    "reason": "Test archiving"
  }'
```

## Troubleshooting

### "Failed to download file"

- Check if original file exists in `690d9d55003242e2a2b1`
- Verify `INTERNAL_API_KEY` has storage read permissions

### "Failed to create document"

- Check `usersReceiptsArchive` collection exists
- Verify relationship attribute `contest` exists

### Timeout errors

- Large files may need longer timeout
- Increase function timeout in Appwrite Console (default 30s)

## Logs

Check Appwrite function logs for detailed execution information:

- Receipt processing status
- File download/upload progress
- Error messages
- Archive completion summary
