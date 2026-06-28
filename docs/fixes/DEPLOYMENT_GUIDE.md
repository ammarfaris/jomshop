# Receipt Functions Critical Fixes - Deployment Guide

## Quick Summary

**Two critical bugs fixed:**
1. **Upload Timeout (408)** - Frequent timeouts when uploading receipts
2. **Archive Storage** - Files not transferred to archive bucket when unsaving contests

**Deployment Priority:** 🔴 HIGH - Deploy ASAP to prevent data inconsistencies

---

## Pre-Deployment Checklist

- [ ] Review both fix documents:
  - `RECEIPT_UPLOAD_TIMEOUT_FIX.md`
  - `ARCHIVE_RECEIPTS_STORAGE_FIX.md`
- [ ] Backup current function code from Appwrite Console
- [ ] Verify you have access to Appwrite Console (Singapore region)
- [ ] Notify users of brief maintenance window (optional, but recommended)

---

## Deployment Steps

### Step 1: Package Functions

```bash
# Navigate to project root
cd /Users/ammarfaris/Developer/jomsolutions/jomcontest/jc-app-aw

# Package validate-receipt-upload
cd functions/validate-receipt-upload
tar --exclude='.DS_Store' --exclude='._*' -czf ../validate-receipt-upload.tar.gz .
cd ..

# Package archive-receipts
cd archive-receipts
tar --exclude='.DS_Store' --exclude='._*' -czf ../archive-receipts.tar.gz .
cd ..

# Verify archives created
ls -lh *.tar.gz
```

You should see:
```
-rw-r--r--  validate-receipt-upload.tar.gz
-rw-r--r--  archive-receipts.tar.gz
```

### Step 2: Deploy validate-receipt-upload (Fix Upload Timeout)

**Appwrite Console Steps:**

1. Go to: https://cloud.appwrite.io/console/project-690692a70013e62b8075/functions
2. Find function: **validate-receipt-upload**
   - Function ID: `69079c76000d70f2b7bb`
3. Click **"Deployments"** tab
4. Click **"Create deployment"**
5. Upload `validate-receipt-upload.tar.gz`
6. Set **Entrypoint**: `index.js`
7. Click **"Deploy"**
8. Wait for status: **Building** → **Active** (2-3 min)

**Verify Deployment:**
```
✓ Status: Active
✓ Last deployment: [timestamp should be recent]
✓ Build logs: No errors
```

### Step 3: Deploy archive-receipts (Fix Storage Transfer)

**Appwrite Console Steps:**

1. Stay in Functions page
2. Find function: **archive-receipts**
   - Function ID: `69082cb4000e24d3e9b1`
3. Click **"Deployments"** tab
4. Click **"Create deployment"**
5. Upload `archive-receipts.tar.gz`
6. Set **Entrypoint**: `index.js`
7. Click **"Deploy"**
8. Wait for status: **Building** → **Active** (2-3 min)

**Verify Environment Variables** (Settings tab):
```
✓ APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
✓ APPWRITE_PROJECT_ID=690692a70013e62b8075
✓ INTERNAL_API_KEY=[set]
✓ DATABASE_ID=6859b128002afc56c476
✓ USERS_RECEIPTS_COLLECTION_ID=usersReceipts
✓ USERS_RECEIPTS_BUCKET_ID=690d9d55003242e2a2b1
✓ USERS_RECEIPTS_ARCHIVE_COLLECTION_ID=usersReceiptsArchive
✓ USERS_RECEIPTS_ARCHIVE_BUCKET_ID=usersReceiptsArchiveBucket
✓ VALIDATE_CAPTCHA_FUNCTION_ID=[set]
✓ SANITIZE_TEXT_FUNCTION_ID=[set]
✓ APP_SETTINGS_COLLECTION_ID=[set]
```

### Step 4: Test Upload Function

**Test Upload:**

1. Open app: https://jomcontest.com
2. Sign in to your test account
3. Go to any contest detail page
4. Click bookmark to save contest
5. Click bookmark again → **Manage Receipts**
6. Click **"Add New Receipt"**
7. Complete CAPTCHA
8. Upload a receipt with notes: "Test upload after fix"
9. **Expected Result**: 
   - ✅ Upload succeeds without 408 error
   - ✅ Receipt appears in list immediately
   - ✅ No timeout errors

**Check Logs:**
- Go to Appwrite Console → Functions → validate-receipt-upload → Executions
- Latest execution should show:
  ```
  ✅ CAPTCHA validation successful
  ✅ Notes sanitized successfully
  ✅ Transaction committed successfully
  ```

### Step 5: Test Archive Function

**Test Archive:**

1. With the contest from Step 4 (that has 1+ receipt)
2. Click bookmark again → **Confirm Unsave**
3. **Expected Result**:
   - ✅ Success message: "Contest removed from saved list"
   - ✅ No error toasts

**Verify in Appwrite Console:**

1. **Database** → `usersReceiptsArchive`:
   - Find your test receipt record
   - Note the `file_id`

2. **Storage** → `usersReceiptsArchiveBucket`:
   - Verify file exists with that `file_id`
   - Should be viewable/downloadable

3. **Storage** → `690d9d55003242e2a2b1` (Users Receipts Bucket):
   - Original file should be GONE

4. **Database** → `usersReceipts`:
   - Original document should be GONE

**Check Logs:**
- Go to Functions → archive-receipts → Executions
- Latest execution should show:
  ```
  Uploading file to archive bucket: [file_id]
  ✅ File uploaded to archive bucket: [file_id]
  ✅ Original file deleted from main bucket: [file_id]
  ✅ Transaction committed successfully
  ```

---

## Post-Deployment Verification

### Critical Checks

- [ ] Upload function: No 408 errors in last 10 uploads
- [ ] Archive function: Files actually transferred to archive bucket
- [ ] Archive function: Original files deleted from main bucket
- [ ] No error increase in Sentry/logs
- [ ] Function execution times reasonable (<15s for upload, <30s for archive)

### Monitor For 24 Hours

Track these metrics:
- **Upload Success Rate**: Should be >95% (was ~70% before)
- **Archive Success Rate**: Should be 100%
- **Storage Usage**: Main bucket should decrease as users unsave contests
- **User Reports**: Should decrease for upload issues

---

## Rollback Plan (If Needed)

If critical issues arise:

### Rollback Upload Function

1. Go to Functions → validate-receipt-upload → Deployments
2. Find previous deployment (before today)
3. Click **"Activate"**
4. Confirm activation

### Rollback Archive Function

1. Go to Functions → archive-receipts → Deployments
2. Find previous deployment (before today)
3. Click **"Activate"**
4. Confirm activation

**Note**: Previous versions have the bugs, only rollback if new version causes worse issues.

---

## Known Issues After Deployment

### Upload Function

**Issue**: First upload after deployment may be slower (~10s)
- **Reason**: Cold start + cache warming
- **Solution**: Normal, subsequent uploads will be faster

### Archive Function

**Issue**: Very large files (>5MB) may take longer to transfer
- **Reason**: Download + Upload process
- **Solution**: Normal behavior, function has 60s timeout

---

## Monitoring Commands

### Check Recent Upload Executions
```bash
# In Appwrite Console
Functions → validate-receipt-upload → Executions
Filter: Last 24 hours
Look for: Status = "completed", no errors
```

### Check Recent Archive Executions
```bash
# In Appwrite Console
Functions → archive-receipts → Executions
Filter: Last 24 hours
Look for: Status = "completed", no errors
```

### Check Storage Usage
```bash
# In Appwrite Console
Storage → 690d9d55003242e2a2b1
Total Files: [should decrease over time]

Storage → usersReceiptsArchiveBucket  
Total Files: [should increase over time]
```

---

## Support & Troubleshooting

### Upload Still Timing Out?

1. Check Singapore region status: https://status.appwrite.io
2. Check function logs for specific error
3. Increase polling maxAttempts in code if needed
4. Consider increasing function timeout (Console → Settings)

### Archive Not Transferring Files?

1. Check function logs for storage errors
2. Verify bucket IDs in environment variables
3. Check API key has storage permissions
4. Verify archive bucket exists and is accessible

### Database/Storage Out of Sync?

1. Check transaction logs in function execution
2. May need manual cleanup (contact dev team)
3. Use database queries to find orphaned records

---

## Success Criteria

**Deploy is successful when:**

1. ✅ Both functions show "Active" status
2. ✅ Test upload completes without 408 error
3. ✅ Test archive transfers files correctly
4. ✅ Logs show expected success messages
5. ✅ No error spike in monitoring
6. ✅ User complaints decrease

**Timeline:** Monitor for 24-48 hours before considering fully stable.

---

## Contact

**Issues During Deployment:**
- Dev Team: [contact info]
- Appwrite Support: https://appwrite.io/support

**Documentation:**
- Upload fix details: `RECEIPT_UPLOAD_TIMEOUT_FIX.md`
- Archive fix details: `ARCHIVE_RECEIPTS_STORAGE_FIX.md`
- This guide: `DEPLOYMENT_GUIDE.md`

