# Search Fix Deployment Guide

## Quick Deployment Steps

Follow these steps in order to deploy the search localization and persistence fixes.

### Step 1: Deploy Meilisearch Admin Function

```bash
# Navigate to the function directory
cd functions/meilisearch-admin

# Create the tar.gz file
tar --exclude='.DS_Store' --exclude='._*' -czf ../all-tar-manual-files/meilisearch-admin.tar.gz .

# Go back to project root
cd ../..
```

Then:
1. Open Appwrite Console
2. Navigate to Functions → meilisearch-admin
3. Upload the new `functions/all-tar-manual-files/meilisearch-admin.tar.gz`
4. Wait for deployment to complete

### Step 2: Re-sync Meilisearch Index

**CRITICAL**: This step is required for localization to work!

Option A - Using Appwrite Console:
1. Go to Functions → meilisearch-admin
2. Click "Execute"
3. In the body field, enter:
   ```json
   {
     "action": "sync"
   }
   ```
4. Click "Execute"
5. Wait for sync to complete (check logs)

Option B - Using API/Code:
```javascript
const { functions } = require('./app/provider/appwrite/api')

await functions.createExecution(
  '68c0fb9d00000f1ab95c', // meilisearch-admin function ID
  JSON.stringify({ action: 'sync' })
)
```

### Step 3: Deploy App Changes

For Web (Next.js):
```bash
# Build and deploy
cd apps/next
npm run build
# Deploy to your hosting platform (Vercel, etc.)
```

For Mobile (Expo):
```bash
# Build for iOS
cd apps/expo
eas build --platform ios

# Build for Android
eas build --platform android
```

### Step 5: Update Meilisearch Index Configuration (Optional)

If you want Malay titles and summaries to be searchable, you need to update the Meilisearch index configuration:

1. Call the setup action on the meilisearch-admin function:
   ```json
   {
     "action": "setup"
   }
   ```

2. **IMPORTANT**: This will update the searchable attributes to include:
   - `title_ms` - Malay titles
   - `summary_ms` - Malay summaries

### Step 6: Re-sync Index (Optional)

If you updated the index configuration, re-sync to index the new fields:

```json
{
  "action": "sync"
}
```

### Step 7: Verify Deployment

1. **Check Meilisearch Sync**:
   - Open Appwrite Console
   - Go to Functions → meilisearch-admin → Executions
   - Verify the sync execution completed successfully
   - Check logs for "✅ Sync completed successfully"

2. **Test Localization**:
   - Sign in to the app
   - Change language to Bahasa Malaysia in Profile
   - Go to Search and search for contests
   - Verify category names are in Bahasa Malaysia
   - Verify "By" text is translated

3. **Test State Persistence**:
   - Perform a search
   - Click on a result
   - Click back
   - Verify search results are still there

## Troubleshooting

### Issue: Categories still showing in English

**Solution**: Make sure you completed Step 2 (Re-sync Meilisearch Index)

Check the sync status:
1. Go to Appwrite Console → Functions → meilisearch-admin → Executions
2. Look for the most recent "sync" execution
3. Check the logs for any errors

### Issue: Search not working at all

**Solution**: Check Meilisearch connection

1. Verify environment variables in the function:
   - `MEILISEARCH_HOST`
   - `MEILISEARCH_ADMIN_API_KEY`

2. Check Meilisearch service is running:
   - Try accessing the Meilisearch host URL
   - Verify API key is valid

### Issue: State not persisting on mobile

**Solution**: Check AsyncStorage permissions

1. Verify `@react-native-async-storage/async-storage` is installed
2. Check app permissions for storage access
3. Clear app cache and try again

### Issue: Language preference not loading

**Solution**: Check Appwrite user preferences

1. Verify user is logged in
2. Check user preferences in Appwrite Console:
   - Go to Auth → Users → [Select User] → Preferences
   - Should see `language: "en"` or `language: "ms"`

## Rollback Procedure

If you need to rollback:

### 1. Rollback App Changes

For Web:
```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Redeploy
cd apps/next
npm run build
# Deploy
```

For Mobile:
- Submit previous app version to stores
- Or use Expo Updates to revert

### 2. Rollback Meilisearch Function (Optional)

Only needed if the function is causing issues:

1. Find previous version of `meilisearch-admin.tar.gz`
2. Upload to Appwrite Console
3. Re-sync index with old function:
   ```json
   {
     "action": "sync"
   }
   ```

## Post-Deployment Checklist

- [ ] Meilisearch admin function deployed
- [ ] Meilisearch index re-synced successfully
- [ ] App deployed (web/mobile)
- [ ] Localization tested in both languages
- [ ] State persistence tested
- [ ] No errors in console/logs
- [ ] Performance is acceptable
- [ ] User feedback collected

## Support

If you encounter issues:

1. Check the logs:
   - Appwrite Console → Functions → Executions
   - Browser console (web)
   - React Native debugger (mobile)

2. Review the documentation:
   - [Search Localization and Persistence Fix](./SEARCH_LOCALIZATION_AND_PERSISTENCE_FIX.md)
   - [Meilisearch Setup](../general/MEILISEARCH_SETUP.md)

3. Common issues are documented in the Troubleshooting section above


