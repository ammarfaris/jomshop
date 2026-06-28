# Quick Setup for Mobile Testing (5 minutes)

## The Problem
You're seeing: **"Camera access requires HTTPS on mobile browsers"**

Mobile browsers require HTTPS for camera access. Your `http://192.168.x.x:3000` won't work.

## The Solution: Use ngrok (Easiest!)

### Step 1: Install ngrok

**macOS:**
```bash
brew install ngrok
```

**Windows/Linux:**
Download from https://ngrok.com/download

### Step 2: Start Your Dev Server

```bash
# In your project root
cd apps/next
yarn dev
```

Your server is now running on `http://localhost:3000`

### Step 3: Create HTTPS Tunnel

**Open a NEW terminal** and run:
```bash
ngrok http 3000
```

You'll see something like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Test on Mobile

1. Copy the `https://abc123.ngrok.io` URL
2. Open it on your phone's browser
3. Click "Scan Document" button
4. Allow camera access when prompted
5. It works! 🎉

## Tips

- The ngrok URL changes each time you restart ngrok
- Free tier is fine for testing
- Both you and your phone need internet connection
- The tunnel works from anywhere (you can share the URL with others)

## Alternative: Deploy to Vercel

If you don't want to use ngrok:

```bash
# Push your code
git add .
git commit -m "Add document scanner"
git push

# Vercel will auto-deploy and give you an HTTPS URL
```

Then test on the Vercel preview URL.

## That's It!

The scanner should now work on mobile with camera access. 📱✅


