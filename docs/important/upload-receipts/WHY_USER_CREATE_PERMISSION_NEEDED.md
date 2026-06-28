# Why We Need User CREATE Permission on Receipt Storage Bucket

## The Critical Clarification

During our analysis, I initially thought we could remove user CREATE permission and handle everything through functions. However, **this is WRONG**. We **DO need** user CREATE permission on the receipts bucket.

## The Core Reality: Client Uploads, Function Validates

### ❌ The Wrong Assumption

**"We're doing receipt upload via function"** - This is incorrect.

### ✅ The Correct Reality

**The CLIENT (user's browser/app) uploads the file directly to Appwrite Storage. The FUNCTION only validates and grants permissions.**

## Technical Flow Breakdown

### Step 1: Client Uploads File Directly (REQUIRES CREATE Permission)

```typescript
// This code runs in the USER'S BROWSER - NOT in the function!
// Location: packages/app/lib/receipts/api.ts, lines 124-129

const uploadedFile = await storage.createFile(
  USERS_RECEIPTS_BUCKET_ID,
  'unique()',
  fileToUpload,  // ← 10MB file goes directly to storage
  []             // ← Empty permissions - file is INACCESSIBLE
)
```

**Why CREATE permission is needed:** The `storage.createFile()` call happens in the client's browser/app, not in the server-side function.

### Step 2: Client Calls Function (Sends Only Metadata)

```typescript
// Function receives ONLY the file ID and metadata
// Location: packages/app/lib/receipts/api.ts, lines 144-153

const execution = await functions.createExecution(
  VALIDATE_RECEIPT_UPLOAD_FUNCTION_ID,
  JSON.stringify({
    fileId: uploadedFile.$id,  // ← Just the ID, not the file!
    userId,
    contestId,
    notes,
    captchaToken
  })
)
```

### Step 3: Function Validates and Grants Permissions

```javascript
// Function updates file permissions (server-side)
// Location: functions/validate-receipt-upload/index.js, lines 388-398

await storage.updateFile(
  USERS_RECEIPTS_BUCKET_ID,
  fileId,
  undefined,
  [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ]
)
```

## The 10MB Appwrite Function Body Limit

**This is why we can't remove CREATE permission:**

```
❌ IMPOSSIBLE: Send file through function
Client → Function receives 10MB file → ❌ FAILS (10MB body limit)

✅ ONLY POSSIBLE: Client uploads directly
Client → Storage receives 10MB file → ✅ WORKS (no body limit)
```

**Key Insight:** Appwrite functions have a 10MB request body limit. Large files must bypass the function entirely.

## Visual Comparison

### Current Working Approach

```
┌─────────┐
│  USER   │
└────┬────┘
     │
     │ 1. Upload file directly (needs CREATE permission)
     ↓
┌─────────────────┐
│ Storage Bucket  │ ← File stored with [] permissions
└─────────────────┘
     │
     │ 2. Call function (send fileId only)
     ↓
┌─────────────────┐
│   Function      │ ← Validates and grants permissions
└─────────────────┘
```

### Broken Alternative (If We Remove CREATE Permission)

```
┌─────────┐
│  USER   │
└────┬────┘
     │
     │ 1. Send file to function (10MB in body)
     ↓
┌─────────────────┐
│   Function      │ ← ❌ FAILS at 10MB limit
└────┬────────────┘
     │
     │ 2. Function tries to upload
     ↓
┌─────────────────┐
│ Storage Bucket  │
└─────────────────┘
```

## What Happens If We Remove CREATE Permission?

```typescript
// Client tries to upload
const uploadedFile = await storage.createFile(
  USERS_RECEIPTS_BUCKET_ID,
  'unique()',
  fileToUpload,
  []
)
// ❌ IMMEDIATE ERROR: 401 Unauthorized
// "User does not have CREATE permission on bucket"

// Upload fails before validation function is even called!
```

## But Is This Secure?

**YES! The approach is secure despite requiring CREATE permission:**

### Security Guarantees

1. **Files start inaccessible** - Empty permissions `[]` mean no one can access them
2. **Function controls access** - Only the validation function can grant permissions
3. **Server-side validation** - Limits and CAPTCHA are enforced server-side
4. **User-specific permissions** - Users can only access their own validated files

### Attack Scenarios & Defenses

#### Attack 1: Upload and Try to Access

```
User uploads file → File created with [] permissions
User tries to view → ❌ BLOCKED (no READ permission)
User tries direct URL → ❌ BLOCKED (401 Unauthorized)
```

#### Attack 2: Upload Without Validation

```
User uploads file → File created with [] permissions
User skips function → File remains inaccessible (orphaned)
After 1 hour → Cleanup function deletes file
Impact: Temporary storage consumption (auto-cleaned)
```

#### Attack 3: Spam Uploads

```
User tries mass upload → CAPTCHA required per upload
CAPTCHA prevents automation → Human verification bottleneck
Orphaned files cleaned hourly → Storage recovered automatically
```

## Risk Assessment: Acceptable Trade-offs

### Low-Risk Scenarios

| Scenario | Impact | Mitigation | Risk Level |
|----------|--------|------------|------------|
| **Orphaned Files** | Temporary storage waste | Hourly cleanup | 🟢 LOW |
| **Storage Spam** | Temporary quota usage | CAPTCHA + cleanup | 🟢 LOW |
| **Abuse Attempts** | Minimal system impact | Server validation | 🟢 LOW |

### Why These Risks Are Acceptable

1. **CAPTCHA bottleneck** - Prevents automated abuse
2. **Automatic cleanup** - Removes orphaned files hourly
3. **File size limits** - 10MB maximum per file
4. **Server validation** - Cannot bypass limits or checks

## The Mailbox Analogy

```
CREATE Permission = "Can drop letters in the mailbox"
READ Permission   = "Can open and read the letters"

┌─────────────────────────────────────┐
│           MAILBOX (BUCKET)          │
├─────────────────────────────────────┤
│ Anyone can DROP letters in          │ ← CREATE permission
│ Only recipient can OPEN letters     │ ← READ permission (granted by validation)
│ Letters stay sealed until validated │ ← Empty permissions []
└─────────────────────────────────────┘
```

## Alternative Solutions (Why They Don't Work)

### ❌ Remove CREATE Permission + Send Through Function

**Problem:** 10MB function body limit
**Result:** Large files cannot be uploaded

### ❌ Pre-signed URLs

**Problem:** Appwrite SDK doesn't support them yet
**Result:** Not available (future feature)

### ✅ Current Hybrid Approach

**Benefits:**
- ✅ Handles large files (up to 10MB)
- ✅ Fast uploads (direct to storage)
- ✅ Secure (files start inaccessible)
- ✅ Server-side validation

**Trade-off:** Requires user CREATE permission (but secure despite this)

## Conclusion: Keep CREATE Permission

### ✅ What We Should Do

1. **Keep CREATE permission** on the receipts bucket
2. **Deploy cleanup function** to handle orphaned files
3. **Monitor for abuse** (though risk is low)
4. **Document this decision** (this file!)

### ❌ What We Should NOT Do

1. **Don't remove CREATE permission** (breaks uploads)
2. **Don't try to route files through functions** (10MB limit)
3. **Don't wait for pre-signed URLs** (not available yet)

### 🎯 Bottom Line

**The current implementation is correct and secure.** We need CREATE permission because clients upload directly to storage (function body limit), but the security model ensures users can only access validated files.

---

## Files Referenced

- `packages/app/lib/receipts/api.ts` - Client upload logic
- `functions/validate-receipt-upload/index.js` - Server validation
- `functions/cleanup-orphaned-receipts/index.js` - Cleanup function

---

## Summary of Key Points

1. **Client uploads directly** - CREATE permission required
2. **Function validates only** - Receives fileId, not file data
3. **10MB limit blocks alternatives** - Files must bypass function
4. **Secure despite CREATE permission** - Empty permissions + validation
5. **Low risk of abuse** - CAPTCHA + cleanup mitigate
6. **Current approach is optimal** - Best balance of security and functionality

---

**Date:** 2025-01-09  
**Conclusion:** ✅ Keep CREATE permission, deploy cleanup function  
**Next Review:** 2025-04-09 (quarterly)

