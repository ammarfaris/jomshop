# CAPTCHA Security Architecture

## Overview

This document explains the complete CAPTCHA verification flow in the JomContest application, from client-side token generation to server-side validation, and why this multi-layered approach provides robust protection against automated attacks and bad actors.

## CAPTCHA Flow: Client → Server

### Phase 1: Client-Side Token Generation

1. **Widget Loading**: User interacts with Cloudflare Turnstile widget
2. **Background Verification**: For non-interactive mode, verification happens automatically
3. **Behavioral Analysis**: Cloudflare analyzes browser fingerprint, IP, and behavioral patterns
4. **Token Generation**: If verification passes, a time-limited token is generated
5. **Client Storage**: Token stored in React state via `setCaptchaToken(token)`

```typescript
// Client-side token reception
<TurnstileWidget
  onSuccess={setCaptchaToken} // Token stored here
  onReady={() => setIsCaptchaReady(true)}
/>
```

### Phase 2: Client → Server Transmission

6. **Form Submission**: User submits feedback with CAPTCHA token
7. **HTTP Request**: Token travels as `captcha_token` in request body

```typescript
// Token transmission to a Supabase Edge Function (e.g. `receipts`)
const { data, error } = await supabase.functions.invoke('receipts', {
  body: {
    user_id: user.id,
    captcha_token: captchaTokenCopy, // Token sent here
    // ...action payload
  },
})
```

### Phase 3: Server-Side Validation

8. **Token Reception**: The Edge Function receives and extracts `captcha_token`
9. **Inline Verification**: The token is verified before any privileged work is done

```typescript
// Inside the Edge Function (Deno): verify the token first
const ok = await verifyTurnstile(captcha_token, ipAddress)
if (!ok) {
  return new Response(JSON.stringify({ error: 'captcha_failed' }), {
    status: 403,
  })
}
```

10. **Cloudflare Verification**: HTTPS request to Cloudflare's verification API

```javascript
// Server-side validation with secret key
async function verifyTurnstile(token, remoteIP) {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY, // Server secret (never exposed)
        response: token, // Client token
        remoteip: remoteIP, // IP binding
      }),
    }
  )

  const result = await response.json()
  return result.success === true
}
```

### Phase 4: Server Response

11. **Verification Result**: Cloudflare returns `{"success": true/false}`
12. **Decision Logic**: Server allows/rejects request based on validation
13. **Client Response**: Success/error communicated back to user

## Security Layers

### 1. Zero-Knowledge Token Generation 🤫

**Mechanism**: Turnstile uses proprietary algorithms analyzing:

- Browser fingerprinting and device characteristics
- Behavioral patterns and network signals
- Canvas/WebGL fingerprinting
- JavaScript execution environment

**Protection**: Impossible to reverse-engineer token generation logic.

### 2. Server-Side Secret Validation 🔐

**Mechanism**: Tokens validated using secret key stored only on server
**Protection**: Even intercepted tokens cannot be validated without server secret

### 3. Time-Limited Tokens ⏱️

**Mechanism**: Tokens expire ~5 minutes after generation
**Protection**: Prevents token stockpiling and replay attacks

### 4. IP Address Binding 📍

**Mechanism**: Each token cryptographically bound to requesting IP
**Protection**: Tokens cannot be reused across different IP addresses

### 5. Behavioral Analysis 👁️

**Mechanism**: Analyzes mouse movements, typing patterns, interaction timing
**Protection**: Detects automated scripts and headless browsers

### 6. Rate Limiting 🛑

**Mechanism**:

- Per user per hour: 20 requests
- Per IP per minute: 10 requests

**Protection**: Provides backup throttling even if CAPTCHA fails

### 7. Distributed Intelligence 🌐

**Mechanism**: Cloudflare's global network shares threat intelligence
**Protection**: Adaptive difficulty based on real-time threat levels

## Attack Vector Analysis

| Attack Method           | Why It Fails                            |
| ----------------------- | --------------------------------------- |
| **Token Reuse**         | IP binding + time limits                |
| **Network Sniffing**    | Server-side secret required             |
| **Reverse Engineering** | Proprietary algorithms                  |
| **Headless Browsers**   | Behavioral analysis detects automation  |
| **Proxy Rotation**      | IP binding requires per-IP verification |
| **CAPTCHA Farms**       | Time limits + behavioral analysis       |

## Economic Considerations 💰

**Cost to bypass effectively**:

- Sophisticated browser automation mimicking humans perfectly
- Constant adaptation to evolving detection methods
- Massive infrastructure for IP rotation
- Ongoing maintenance and updates

**Reality**: Most attackers find legitimate access more cost-effective than sophisticated bypass attempts.

## Implementation Details

### Client-Side Configuration

- **Mode**: Non-interactive with pre-clearance
- **Theme**: Auto (light/dark based on system)
- **Size**: Normal
- **Platform-specific**: Web, Android (WebView), iOS (WebView)

### Server-Side Configuration

- **Secret Key**: Stored as a Supabase Edge Function secret (`TURNSTILE_SECRET_KEY`)
- **Validation Endpoint**: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Rate Limiting**: Action-specific limits with database tracking
- **Logging**: Suspicious activity tracking

## Security Flow Summary

```
Client (Browser/Mobile App)
    ↓ Token Generated by Turnstile Widget (Proprietary Algorithm)
Supabase Edge Function (e.g. receipts)
    ↓ Token verified inline against Cloudflare
Cloudflare API (turnstile/v0/siteverify)
    ↓ Token verified with secret key + IP binding
Supabase Edge Function
    ↓ Result returned (success/failure)
```

## Key Security Principles

1. **Never trust client-side validation alone**
2. **Server-side secrets stay on server**
3. **Time and IP binding prevent reuse**
4. **Multiple independent verification layers**
5. **Fail-safe with rate limiting**
6. **Continuous adaptation via AI/ML**

## Important Security Limitation ⚠️

### CAPTCHA Does NOT Protect Against Direct API Access

**Critical**: This CAPTCHA system **only protects the client-side submission flow**. It does **NOT** prevent direct API access to write to the feedback table.

#### What CAPTCHA Protects Against:

- ✅ Automated bots using the web/mobile interface
- ✅ Spam submissions through normal user flows
- ✅ Abuse via the intended submission endpoints

#### What CAPTCHA Does NOT Protect Against:

- ❌ **Direct Supabase client writes** (if RLS allows the write, an authenticated user can bypass CAPTCHA)
- ❌ Edge Function bypass (if authentication is compromised)
- ❌ Administrative access with proper permissions

#### Additional Security Layers Needed:

1. **Row Level Security (RLS)**:

   ```sql
   -- Revoke direct client INSERTs so writes must go through the Edge Function
   -- (which uses the service role). Keep SELECT scoped to the owner.
   ```

2. **Service Role Key Protection**:

   - Keep `SUPABASE_SERVICE_ROLE_KEY` only in Edge Function secrets
   - Never expose it in any client bundle
   - Rotate keys if leaked

3. **Edge Function Authorization**:

   ```typescript
   // Edge Functions should validate:
   // - User authentication (JWT)
   // - CAPTCHA tokens (for public/abuse-prone endpoints)
   // - Rate limits
   // - Input sanitization
   ```

4. **Audit Logging**:
   - Log privileged writes
   - Monitor for suspicious patterns
   - Alert on unusual activity

#### Locking Down Sensitive Writes with RLS:

For abuse-prone tables (e.g. `receipts`), direct client INSERTs are revoked via RLS:

- **Client role**: `SELECT` own rows only — no direct `INSERT`
- **Enforcement**: The `receipts` Edge Function validates CAPTCHA + rate limits, then writes with the service role key
- **Result**: The full CAPTCHA/rate-limit/sanitize chain cannot be bypassed for those writes ✅

#### Security Architecture Summary:

```
User Interface (CAPTCHA Protected)
    ↓ (via Supabase Edge Function with CAPTCHA validation)
Edge Function (CAPTCHA + Auth + Rate Limiting)
    ↓ (service-role write)
Postgres (RLS: clients cannot INSERT directly)
```

**Reality**: CAPTCHA alone can be bypassed by direct API calls — **RLS + Edge Function enforcement** is what actually protects sensitive writes. 🔐

**Bottom Line**: CAPTCHA protects the **user-facing attack surface**, but you need **RLS and access control** to protect the underlying data.

This architecture provides enterprise-grade protection while maintaining smooth user experience through non-interactive verification.
