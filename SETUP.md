# ST Negation Tool — Setup Guide

## What This Is

A web app (like Helium10 or Sellerboard) that connects to your Amazon Advertising account with **one click**. No API keys to paste, no CSV files to download — just click "Connect Amazon Account" and go.

---

## What You Need

1. **An Amazon Advertising API developer account** (you said you have one)
2. **A free Vercel account** (takes 2 minutes to create)

---

## Step 1: Get Your Amazon App Credentials

If you already have an Amazon Advertising API app registered, you just need:
- **Client ID** (looks like: `amzn1.application-oa2-client.xxxxx`)
- **Client Secret** (a long string)

If you need to set up the OAuth redirect URL in your Amazon app settings, add:
```
https://your-app-name.vercel.app/auth/callback
```
(You'll know the exact URL after Step 3)

---

## Step 2: Create a Free Vercel Account

1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Sign Up"**
3. Sign up with GitHub, GitLab, or email
4. Done! This is where your tool will live on the internet

---

## Step 3: Deploy to Vercel (5 minutes)

### Option A: One-Click Deploy (Easiest)

1. **Upload this project to GitHub:**
   - Go to [github.com/new](https://github.com/new)
   - Create a new repository called `st-negation-tool`
   - Upload all the files from the `st-negation-web` folder

2. **Connect to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click **"Import Git Repository"**
   - Select your `st-negation-tool` repo
   - Click **"Deploy"**

3. **Add Environment Variables** (in Vercel dashboard):
   - Go to your project → **Settings** → **Environment Variables**
   - Add these:
     ```
     AMAZON_CLIENT_ID = amzn1.application-oa2-client.xxxxx
     AMAZON_CLIENT_SECRET = your-secret-here
     SESSION_SECRET = any-random-string-abc123
     APP_URL = https://your-app-name.vercel.app
     ```
   - Click **Save**

4. **Redeploy** (needed after adding env vars):
   - Go to **Deployments** tab → click **⋮** on latest → **Redeploy**

### Option B: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to project folder
cd st-negation-web

# Deploy
vercel

# Follow the prompts (select your account, etc.)
# It will give you a URL like: https://st-negation-tool.vercel.app
```

Then add environment variables in the Vercel dashboard (same as Step 3 above).

---

## Step 4: Update Amazon App Redirect URL

1. Go to [developer.amazon.com](https://developer.amazon.com) → your app
2. In **"Allowed Return URLs"** add:
   ```
   https://your-app-name.vercel.app/auth/callback
   ```
3. Save

---

## Step 5: Use It!

1. Open your Vercel URL in any browser
2. Click **"🔗 Connect Amazon Account"**
3. Log in to Amazon → Click "Allow"
4. Select an account → Choose date range → Pull search terms
5. Set thresholds → Review → Auto-apply or download CSV

---

## How It Works (Simple Explanation)

```
You click "Connect"
    ↓
Amazon login page opens → you enter password & click "Allow"
    ↓
Amazon sends a secret code back to your Vercel app
    ↓
Your app uses that code to talk to Amazon's API
    ↓
Pulls all search terms, shows you the data
    ↓
You set thresholds → click "Apply" → negative keywords are created!
```

This is the EXACT same flow that Helium10, Jungle Scout, and every other Amazon PPC tool uses. It's the official, supported way to connect.

---

## Running Locally (For Testing)

If you want to test on your computer first:

```bash
# Install Node.js from: https://nodejs.org

# Navigate to project folder
cd st-negation-web

# Install dependencies
npm install

# Create a .env file with your credentials
cp .env.example .env
# Edit .env and fill in your Client ID, Client Secret

# Run the server
npm start

# Open: http://localhost:3000
```

---

## File Structure

```
st-negation-web/
├── server.js          ← Backend (handles OAuth + API calls)
├── package.json       ← Dependencies
├── .env.example       ← Template for your credentials
├── public/
│   ├── index.html     ← Frontend (styles)
│   └── app.js         ← Frontend (logic)
└── SETUP.md           ← This file
```

---

## FAQ

**Q: Is this free?**
A: Vercel free tier handles thousands of requests. Amazon API is free to use.

**Q: Is it secure?**
A: Your Amazon tokens are stored in encrypted server-side sessions, never exposed to the browser. Same as any professional tool.

**Q: Can my team use it?**
A: Yes! Anyone with the URL can connect their Amazon account. Each person gets their own session.

**Q: Can I use a custom domain?**
A: Yes! In Vercel dashboard → Settings → Domains → add your domain.
