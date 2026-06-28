# Update Receipt Notes Function

This Appwrite function securely updates receipt notes with server-side text sanitization.

## Features

- **Ownership Verification**: Ensures only the receipt owner can update notes
- **Text Sanitization**: Removes potentially harmful content (XSS, HTML tags, scripts)
- **Character Limit**: Enforces 200 character limit for notes
- **Security Logging**: Logs suspicious activity when dangerous content is detected

## Environment Variables Required

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `INTERNAL_API_KEY`
- `DATABASE_ID`
- `SANITIZE_TEXT_FUNCTION_ID`
- `USERS_RECEIPTS_COLLECTION_ID`

## Request Format

```json
{
  "receiptId": "receipt_id_here",
  "userId": "user_id_here",
  "notes": "Updated notes text"
}
```

## Response Format

### Success (200)
```json
{
  "success": true,
  "data": {
    "receiptId": "receipt_id_here",
    "notes": "Sanitized notes text",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error (400/403/500)
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Deployment

1. Build the tar.gz file:
```bash
cd functions/update-receipt-notes
tar --exclude='.DS_Store' --exclude='._*' -czf ../all-tar-manual-files/update-receipt-notes.tar.gz .
```

2. Upload to Appwrite Console:
   - Go to Functions → Create Function
   - Name: `update-receipt-notes`
   - Runtime: `Node.js 18.0`
   - Entrypoint: `index.js`
   - Upload the tar.gz file
   - Set environment variables
   - Deploy

## Security

- All notes are sanitized server-side using the `sanitize-text` function
- Ownership verification prevents unauthorized updates
- Dangerous content (HTML, scripts, XSS) is automatically removed
- Suspicious activity is logged for monitoring

