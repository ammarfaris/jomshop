# Deploy Archive Receipts Function

## Changes Made

The `archive-receipts` function has been updated to support admin operations:

- **Admin Detection**: Checks if the authenticated user is a member of the admin team
- **Bypass Ownership Validation**: Admins can archive receipts for any user
- **Cross-User Archiving**: Enables contest deletion to archive all users' receipts

## Environment Variables Required

Make sure the following environment variable is set in the Appwrite function settings:

```
ADMIN_TEAM_ID=<your-admin-team-id>
```

## Deployment Steps

### 1. Package the Function

The function has already been packaged as `functions/archive-receipts.tar.gz`

If you need to repackage:

```bash
tar --exclude='.DS_Store' --exclude='._*' -czf functions/archive-receipts.tar.gz -C functions/archive-receipts .
```

### 2. Deploy via Appwrite Console

1. Go to Appwrite Console → Functions
2. Find the "archive-receipts" function (ID: `69083b5100310d3e8195`)
3. Go to "Settings" → "Deployment"
4. Upload `functions/archive-receipts.tar.gz`
5. Wait for deployment to complete

### 3. Verify Environment Variables

1. Go to function "Settings" → "Variables"
2. Ensure `ADMIN_TEAM_ID` is set
3. If not set, add it with your admin team ID

### 4. Test the Function

After deployment, test by:

1. Creating a test contest with receipts from multiple users
2. Deleting the contest as an admin
3. Verify all receipts are archived in `usersReceiptsArchive` collection
4. Check logs for "Admin archiving receipt for user X" messages

## What Changed

### Before

- Function validated that `authenticatedUserId === userId`
- Only the receipt owner could archive their own receipts
- Admin couldn't archive other users' receipts

### After

- Function checks if user is in admin team
- If admin: bypasses user ownership validation
- If not admin: validates ownership as before
- Logs admin operations for audit trail

## Rollback

If issues occur, you can rollback by:

1. Reverting the function code to the previous version
2. Repackaging and redeploying
3. The client code will continue to work (just with limited archiving)
