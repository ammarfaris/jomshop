# Validate Receipt Upload Function

## Overview

This Appwrite Function provides server-side validation for receipt uploads, enforcing limits that cannot be bypassed by client-side code manipulation.

## Security Features

- **Server-side limit enforcement**: Prevents users from exceeding configurable limits
- **Atomic operations**: File upload and database record creation are handled together
- **Automatic cleanup**: If document creation fails, the uploaded file is automatically deleted
- **User-level permissions**: Files and documents are only accessible to the user who created them

## Validation Rules

1. **Max Contests with Receipts**: Default 5 (configurable via app_settings)
2. **Max Receipts per Contest**: Default 3 (configurable via app_settings)

## Request Format

**Method**: POST  
**Content-Type**: multipart/form-data

**Form Fields**:
- `userId` (string, required): The authenticated user's ID
- `contestId` (string, required): The contest ID for this receipt
- `notes` (string, optional): User notes for this receipt
- `fileOrder` (number, required): Order of this receipt (0-2)
- `fileType` (string, required): MIME type (e.g., image/jpeg, application/pdf)
- `file` (file, required): The receipt file to upload

## Response Format

### Success (201)

```json
{
  "success": true,
  "data": {
    "receiptId": "unique_receipt_id",
    "fileId": "unique_file_id",
    "userId": "user_id",
    "contestId": "contest_id",
    "notes": "User notes",
    "fileOrder": 0,
    "fileType": "image/jpeg",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Error (400, 403, 500)

```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "ERROR_CODE"
}
```

**Error Codes**:
- `MAX_CONTESTS_REACHED`: User has reached the maximum number of contests with receipts
- `MAX_RECEIPTS_PER_CONTEST_REACHED`: Contest has reached the maximum number of receipts
- `INTERNAL_ERROR`: Unexpected server error

## Environment Variables

Required environment variables in Appwrite Function settings:

- `APPWRITE_ENDPOINT`: Your Appwrite endpoint (e.g., https://fra.cloud.appwrite.io/v1)
- `APPWRITE_PROJECT_ID`: Your project ID
- `APPWRITE_API_KEY`: API key with the following scopes:
  - databases.read
  - databases.write
  - documents.read
  - documents.write
  - files.write

## Deployment

1. Create the function in Appwrite Console:
   - Runtime: Node.js 18.0
   - Entrypoint: src/main.js
   - Execute Access: users (authenticated users)
   - Timeout: 15 seconds
   - Memory: 512MB

2. Set environment variables (see above)

3. Deploy the function code:
   ```bash
   cd functions/validate-receipt-upload
   npm install
   # Deploy via Appwrite CLI or Console
   ```

4. Test the function with a sample request

## Testing

Test with curl:

```bash
curl -X POST \
  'https://[YOUR_ENDPOINT]/functions/validateReceiptUpload/executions' \
  -H 'X-Appwrite-Project: [APPWRITE_PROJECT_ID]' \
  -H 'X-Appwrite-JWT: [USER_JWT]' \
  -F 'userId=user123' \
  -F 'contestId=contest456' \
  -F 'notes=Entry 1' \
  -F 'fileOrder=0' \
  -F 'fileType=image/jpeg' \
  -F 'file=@/path/to/receipt.jpg'
```

## Monitoring

Monitor function executions in Appwrite Console:
- Check execution logs for errors
- Monitor response times
- Track success/failure rates
- Review error codes for common issues

## Troubleshooting

### Issue: "MAX_CONTESTS_REACHED" error
- User has reached the limit of contests with receipts
- Solution: Upgrade to Pro tier or wait for limit reset

### Issue: "MAX_RECEIPTS_PER_CONTEST_REACHED" error  
- Contest has maximum receipts already
- Solution: Delete an existing receipt or upgrade to Pro

### Issue: "INTERNAL_ERROR"
- Check function logs in Appwrite Console
- Verify environment variables are set correctly
- Check API key has required permissions
- Verify database and bucket IDs are correct

## Future Enhancements

- Add image compression before upload
- Add OCR for receipt data extraction
- Add virus scanning integration
- Add receipt expiration policies
- Add analytics for upload patterns

