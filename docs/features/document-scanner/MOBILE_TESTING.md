# Mobile Testing Guide for Document Scanner

## Problem

Mobile browsers (iOS Safari, iOS Chrome, Android Chrome) require **HTTPS** for camera access via `getUserMedia()`.

Even when accessing via `localhost` or local IP (e.g., `192.168.x.x`), mobile browsers will block camera access without HTTPS.

## Solutions

### Option 1: Use ngrok (Easiest - Recommended)

**ngrok** creates a secure HTTPS tunnel to your local dev server.

1. **Install ngrok**:

   ```bash
   # Using Homebrew (macOS)
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Start your Next.js dev server**:

   ```bash
   cd apps/next
   yarn dev
   # Server runs on http://localhost:3000
   ```

3. **Create HTTPS tunnel**:

   ```bash
   # In a new terminal
   ngrok http 3000
   ```

4. **Use the HTTPS URL**:
   - ngrok will show something like: `https://abc123.ngrok.io`
   - Open this URL on your mobile device
   - Camera access will work! ✅

**Pros**:

- No configuration needed
- Works on all devices
- Free tier available

**Cons**:

- URL changes each time (unless you have a paid plan)
- Requires internet connection

---

### Option 2: Use mkcert for Local HTTPS (Best for Development)

**mkcert** creates locally-trusted SSL certificates.

1. **Install mkcert**:

   ```bash
   # macOS
   brew install mkcert
   brew install nss # for Firefox support

   # Install local CA
   mkcert -install
   ```

2. **Generate certificates**:

   ```bash
   cd apps/next
   mkdir -p .cert
   mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost.pem localhost 192.168.1.x
   # Replace 192.168.1.x with your actual local IP
   ```

3. **Update package.json**:

   ```json
   {
     "scripts": {
       "dev": "next dev",
       "dev:https": "NODE_OPTIONS='--require ./https-server.js' next dev"
     }
   }
   ```

4. **Create https-server.js**:

   ```javascript
   const fs = require('fs')
   const https = require('https')

   const httpsOptions = {
     key: fs.readFileSync('.cert/localhost-key.pem'),
     cert: fs.readFileSync('.cert/localhost.pem'),
   }

   // Next.js will use this
   process.env.HTTPS = 'true'
   process.env.SSL_KEY_FILE = '.cert/localhost-key.pem'
   process.env.SSL_CRT_FILE = '.cert/localhost.pem'
   ```

5. **Run with HTTPS**:

   ```bash
   yarn dev:https
   # Access via https://localhost:3000 or https://192.168.1.x:3000
   ```

6. **Trust certificate on mobile**:
   - iOS: Settings → General → About → Certificate Trust Settings
   - Android: Settings → Security → Install certificates

**Pros**:

- Proper HTTPS locally
- Same URL every time
- Works offline

**Cons**:

- Requires setup
- Need to trust certificate on each device

---

### Option 3: Use Cloudflare Tunnel (Alternative)

Similar to ngrok but with Cloudflare.

1. **Install cloudflared**:

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. **Start tunnel**:

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Use the HTTPS URL** provided by Cloudflare

---

### Option 4: Deploy to Vercel/Netlify (For Testing)

Deploy a preview branch to get a real HTTPS URL.

```bash
# Push to a test branch
git checkout -b test-scanner
git push origin test-scanner

# Vercel will auto-deploy and give you an HTTPS preview URL
```

---

## Quick Start (Recommended: ngrok)

```bash
# Terminal 1: Start Next.js
cd apps/next
yarn dev

# Terminal 2: Start ngrok
ngrok http 3000

# Copy the https://xxx.ngrok.io URL and open on your phone
```

## Testing Checklist

- [ ] HTTPS URL (check for lock icon in browser)
- [ ] Camera permission prompt appears
- [ ] Click "Allow" on permission prompt
- [ ] Green highlights appear when document detected
- [ ] Capture button works
- [ ] Scanned image uploads successfully

## Common Issues

### "Camera access is not supported on this browser"

- ❌ Using HTTP instead of HTTPS
- ✅ Use one of the HTTPS solutions above

### "Camera permission denied"

- User clicked "Deny" on permission prompt
- Go to browser settings → Site settings → Camera → Allow
- Reload the page

### "Camera is already in use"

- Another app/tab is using the camera
- Close other camera apps
- Reload the page

### Certificate errors on mobile

- For mkcert: Install and trust the certificate on the device
- For ngrok/Cloudflare: Should work automatically

## Browser Support

| Browser | iOS        | Android    | Desktop |
| ------- | ---------- | ---------- | ------- |
| Safari  | ✅ (HTTPS) | N/A        | ✅      |
| Chrome  | ✅ (HTTPS) | ✅ (HTTPS) | ✅      |
| Firefox | ✅ (HTTPS) | ✅ (HTTPS) | ✅      |
| Edge    | N/A        | ✅ (HTTPS) | ✅      |

All mobile browsers require HTTPS for camera access.
