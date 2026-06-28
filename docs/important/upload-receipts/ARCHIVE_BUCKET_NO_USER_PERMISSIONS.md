# Why Archive Bucket Doesn't Need User Permissions

## Overview

The **archive receipts function** works completely differently from the **upload process**. While the main receipts bucket requires user CREATE permission (for direct client uploads), the **archive bucket has NO user permissions** because the function handles everything server-side.

## Key Difference: Function vs Client Operations

### ❌ Main Receipts Bucket (User CREATE Permission Needed)

```
Client Uploads → Function Validates → User Accesses
```

**Why CREATE needed:** Client uploads directly to storage (10MB limit)

### ✅ Archive Bucket (No User Permissions Needed)

```
User Requests Archive → Function Handles Everything → No User Access
```

**Why no permissions:** Function does all operations server-side

---

## Archive Function Technical Flow

### Step 1: User Initiates Archive Request

```typescript
// Client calls function (user doesn't touch archive bucket)
const result = await functions.createExecution(
  ARCHIVE_RECEIPTS_FUNCTION_ID,
  JSON.stringify({
    receiptIds: ['receipt1', 'receipt2'],
    contestId: 'contest123',
    userId: userId,
    jwtToken: jwtToken,  // For authentication
    reason: 'Contest unsaved'
  })
)
```

**User provides:** Receipt IDs, contest ID, JWT token  
**User accesses:** Nothing on archive bucket (no permissions)

### Step 2: Function Validates User Ownership

```javascript
// Function validates user owns receipts using JWT
const jwtClient = new Client().setJWT(jwtToken)
const authenticatedUser = await jwtAccount.get()

// Verify user owns the receipts
if (receipt.user_id !== userId) {
  throw new Error('Receipt does not belong to user')
}
```

**Security:** JWT authentication ensures user owns receipts

### Step 3: Function Downloads Files (Server-Side)

```javascript
// Function downloads from main bucket using API key
const fileUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${USERS_RECEIPTS_BUCKET_ID}/files/${receipt.file_id}/view?project=${APPWRITE_PROJECT_ID}`

const response = await fetch(fileUrl, {
  headers: {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': INTERNAL_API_KEY,  // Server access
  },
})
```

**Server access:** Function uses API key, not user permissions

### Step 4: Function Uploads to Archive Bucket

```javascript
// Function uploads to archive bucket with NO permissions
await storage.createFile(
  USERS_RECEIPTS_ARCHIVE_BUCKET_ID,
  newFileId,
  inputFile,
  []  // ← EMPTY PERMISSIONS - Admin only access
)
```

**Archive security:** Files uploaded with `[]` permissions (server-only access)

### Step 5: Function Creates Archive Records

```javascript
// Archive records also have NO permissions
await tablesDB.createRow({
  databaseId: DATABASE_ID,
  tableId: USERS_RECEIPTS_ARCHIVE_COLLECTION_ID,
  rowId: ID.unique(),
  data: archiveData,
  permissions: [],  // ← NO USER PERMISSIONS
})
```

**Database security:** Archive records are admin-only

### Step 6: Function Cleans Up Originals

```javascript
// Delete original files and records
await storage.deleteFile(USERS_RECEIPTS_BUCKET_ID, receipt.file_id)
await tablesDB.deleteRow({
  databaseId: DATABASE_ID,
  tableId: USERS_RECEIPTS_COLLECTION_ID,
  rowId: receiptId,
})
```

**Cleanup:** Original data removed atomically

---

## Why Archive Bucket Has No User Permissions

### 1. **Purpose: Admin-Only Archive Storage**

```
Archive Bucket ≠ User Storage

├── Main Bucket: User-accessible receipts
│   ├── CREATE: Role.users() (users upload)
│   ├── READ: Role.user(userId) (users view own)
│   └── DELETE: Role.user(userId) (users delete own)
│
└── Archive Bucket: Admin-only archived data
    ├── CREATE: None (server only)
    ├── READ: None (server only)
    └── DELETE: None (server only)
```

**Archive purpose:** Store deleted receipts for compliance/admin purposes, not user access

### 2. **Security: Archive Data is Sensitive**

**Why no user access to archives:**
- Archive contains deleted receipts (user chose to remove)
- Archive data might contain sensitive information
- Archive is for compliance/audit purposes only
- Users should not access their "deleted" data

**Access model:** Server-only access via API key

### 3. **Process: Function Handles Everything**

```
User Action: "Delete my receipts" (unsave contest)
├── Client: Calls archive function
├── Function: Validates ownership
├── Function: Moves files to archive (server-side)
├── Function: Deletes originals
└── Result: User data archived, originals deleted
```

**User never directly touches archive bucket**

### 4. **Risk Mitigation: No User Access Vectors**

**Why users can't access archive:**
- No READ permission on archive bucket
- No READ permission on archive collection
- Function uses API key (server-only operations)
- Archive files uploaded with `[]` permissions

**Attack prevention:** No user access = no attack surface

---

## Permission Comparison

### Main Receipts Bucket (User Access Required)

| Operation | Permission Level | Why? |
|-----------|------------------|------|
| **CREATE** | `Role.users()` | Client uploads directly |
| **READ** | `Role.user(userId)` | Users view own receipts |
| **UPDATE** | `Role.user(userId)` | Users edit notes |
| **DELETE** | `Role.user(userId)` | Users delete receipts |

### Archive Bucket (No User Permissions)

| Operation | Permission Level | Why? |
|-----------|------------------|------|
| **CREATE** | None | Function uploads server-side |
| **READ** | None | Admin-only archive access |
| **UPDATE** | None | Archive is read-only |
| **DELETE** | None | Archive preserved for compliance |

---

## Security Benefits of Archive Design

### 1. **Complete User Isolation**

```
User Permissions:
├── Can upload to main bucket ✅
├── Can access own receipts ✅
├── Can delete receipts ✅
└── Can access archive bucket ❌ (by design)
```

**Security:** Users can't access their archived/deleted data

### 2. **Server-Controlled Operations**

```
All Archive Operations:
├── File movement (server-side) ✅
├── Record creation (server-side) ✅
├── Cleanup (server-side) ✅
└── Validation (server-side) ✅
```

**Security:** No client-side operations on archive data

### 3. **Compliance-Ready Storage**

```
Archive Characteristics:
├── Immutable after archiving ✅
├── Admin-only access ✅
├── Audit trail maintained ✅
└── Compliance preservation ✅
```

**Security:** Archive data preserved but not user-accessible

---

## Why This Design Makes Sense

### Business Logic

1. **User Intent:** When user unsaves a contest, they want receipts "gone"
2. **But:** We need to keep receipts for compliance/audit purposes
3. **Solution:** Move to archive (server-only access) and delete from user view

### Technical Benefits

1. **Security:** Archive data protected from user access
2. **Simplicity:** Function handles all operations
3. **Atomicity:** All operations in single transaction
4. **Cleanup:** Original data properly removed

### Risk Assessment

**Can users access archive?** ❌ No
- No permissions on archive bucket
- No permissions on archive collection
- Function uses API key for all operations
- Archive files have `[]` permissions

**Can users interfere with archiving?** ❌ No
- Function validates ownership first
- JWT authentication required
- Server-side operations only

---

## Implementation Checklist

### Archive Bucket Configuration

- [x] **CREATE permission:** None (server only)
- [x] **READ permission:** None (server only)
- [x] **UPDATE permission:** None (server only)
- [x] **DELETE permission:** None (server only)
- [x] **File permissions:** `[]` (empty array)
- [x] **Collection permissions:** `[]` (empty array)

### Function Configuration

- [x] **Execute access:** users (authenticated)
- [x] **JWT validation:** Required for user auth
- [x] **API key access:** Required for server operations
- [x] **Transaction support:** Atomic operations
- [x] **Rollback support:** Error recovery

### Security Verification

- [x] **User can't access archive bucket:** No permissions
- [x] **User can't access archive records:** No permissions
- [x] **Function validates ownership:** JWT + ownership check
- [x] **Server-only operations:** API key required

---

## Summary

### Main Receipts Bucket
- **User CREATE needed:** Client uploads directly (10MB limit)
- **User access required:** Users view/edit/delete own receipts
- **Hybrid security:** Upload with no permissions → function grants access

### Archive Bucket
- **No user permissions:** Server-only operations
- **Admin-only access:** Archive data not user-accessible
- **Function-controlled:** All operations handled server-side
- **Security by design:** Users can't access archived/deleted data

### Key Insight
**The difference is fundamental:**
- **Upload:** Client → Storage (needs user permissions)
- **Archive:** Client → Function → Storage (no user permissions needed)

**Archive bucket is intentionally user-inaccessible by design.**

---

## Related Files

- `functions/archive-receipts/index.js` - Archive function implementation
- `functions/archive-receipts/README.md` - Archive function documentation
- `WHY_USER_CREATE_PERMISSION_NEEDED.md` - Main bucket permission explanation

---

**Conclusion:** Archive bucket has no user permissions because it's admin-only archive storage that users should not access. The function handles all operations server-side using API keys.

---

**Date:** 2025-01-09  
**Status:** ✅ Archive design verified secure

