# 🚂 Railway Deployment Guide

## Quick Deploy to Railway

### Prerequisites
- Railway account: [railway.app](https://railway.app)
- Your GitHub repository connected

### Step 1: Deploy to Railway

1. **Create New Project**
   - Go to [Railway Dashboard](https://dashboard.railway.app)
   - Click **New Project** → **Deploy from GitHub repo**
   - Select your `AutoFix-AI` repository

2. **Configure Environment Variables**
   
   Go to your service → **Variables** tab and add:
   
   ```
   OPENAI_API_KEY=your_openai_or_cerebras_key_here
   GITHUB_TOKEN=your_github_personal_access_token_here
   PORT=8080
   ```

3. **Railway will auto-detect the Dockerfile**
   
   Railway will use the `Dockerfile` in the root directory automatically.

4. **Generate Domain**
   
   - Go to **Settings** → **Networking**
   - Click **Generate Domain**
   - Copy your domain (e.g., `autofix-ai.up.railway.app`)

### Step 2: Update Frontend (Vercel)

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Update `KESTRA_URL` to your Railway URL:
   ```
   KESTRA_URL=https://your-app-name.up.railway.app
   ```
3. Redeploy Vercel

### Step 3: Test

1. Visit `https://your-app-name.up.railway.app` - you should see Kestra UI
2. Your frontend at Vercel should now connect to the Railway backend

## Troubleshooting

### App crashes on start
- Check the **Logs** in Railway dashboard
- Verify environment variables are set correctly
- Ensure you have $5+ credit (Railway requires it for builds)

### Connection issues from Vercel
- Make sure your Railway domain is publicly accessible
- Check CORS configuration in the Dockerfile
- Verify `KESTRA_URL` in Vercel matches your Railway domain

### Out of memory
- Upgrade Railway plan (Kestra requires ~512MB RAM minimum)
- The Dockerfile uses H2 in-memory database to reduce memory usage

## Alternative: Full Docker Compose with Postgres

If you need a production setup with Postgres, use a different deployment platform like:
- **AWS EC2** (see `DEPLOY_BACKEND.md`)
- **DigitalOcean** (see `DEPLOY_BACKEND.md`)
- **Render with Postgres addon** (see `DEPLOY_BACKEND.md`)

Railway's free tier doesn't support Docker Compose with multiple services well, so this simplified version uses H2 database.

## Notes

- The Railway deployment uses **H2 in-memory database** instead of Postgres for simplicity
- Data will be lost on restarts (suitable for MVP/testing)
- For production, use a persistent database setup (see `DEPLOY_BACKEND.md` for options)
