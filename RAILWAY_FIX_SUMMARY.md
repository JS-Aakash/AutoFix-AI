# 🚀 Railway Deployment Fix - Summary

## Problem Identified

When deploying to Railway, you encountered this error:
```
Usage: node agent.js --issue-body <text> --repo-path <path>
OpenAIError: The OPENAI_API_KEY environment variable is missing or empty
```

## Root Cause

**Issue 1: Missing Environment Variables**
- Railway doesn't automatically use your local `.env` file
- Environment variables need to be configured in Railway's dashboard

**Issue 2: Wrong Entry Point**
- Railway was trying to run `npm start` → `node src/agent.js` directly
- `agent.js` is designed to be called by Kestra workflows with specific command-line arguments
- Running it without arguments causes the "Usage:" error

## Solution Implemented

### Files Created/Modified

1. **`Dockerfile`** (Root directory)
   - Railway-optimized Dockerfile
   - Uses Kestra with H2 in-memory database (simpler than Postgres for Railway)
   - Includes Node.js, all dependencies, and proper configuration
   - Exposes port 8080 for the Kestra web UI and API

2. **`railway.json`**
   - Railway configuration file
   - Specifies which Dockerfile to use
   - Sets proper health checks and restart policies

3. **`DEPLOY_RAILWAY.md`**
   - Complete step-by-step Railway deployment guide
   - Instructions for setting environment variables
   - Troubleshooting tips

4. **`.dockerignore`**
   - Optimizes Docker build by excluding unnecessary files
   - Speeds up deployment

5. **`README.md`** (Updated)
   - Added cloud deployment section with links to all deployment guides

## Next Steps for You

### 1. Push Changes to GitHub

```bash
git add .
git commit -m "Add Railway deployment configuration"
git push origin main
```

### 2. Configure Railway

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your project** (or create new one from GitHub)
3. **Add Environment Variables** (Variables tab):
   ```
   OPENAI_API_KEY=csk-6cyxt48f4eyw8xjw59rhnd3tj9xw465e6rvk8kxv8rwyfrj6
   GITHUB_TOKEN=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
   PORT=8080
   ```

4. **Railway will auto-detect** the `Dockerfile` and rebuild

### 3. Get Your Railway URL

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy the URL (e.g., `https://autofix-ai.up.railway.app`)

### 4. Update Vercel Frontend

1. Go to Vercel → Your project → **Settings** → **Environment Variables**
2. Update `KESTRA_URL` to your Railway URL:
   ```
   KESTRA_URL=https://your-app-name.up.railway.app
   ```
3. Redeploy Vercel

### 5. Test

- Visit your Railway URL to see the Kestra UI
- Use your frontend to trigger a workflow
- Check Railway logs if issues occur

## Important Notes

### About H2 vs Postgres
- The Railway Dockerfile uses **H2 in-memory database** instead of Postgres
- This makes deployment simpler (single container)
- ⚠️ **Data will be lost on restarts** (workflows, logs, etc.)
- For production with persistent data, use AWS EC2 or DigitalOcean (see `DEPLOY_BACKEND.md`)

### Memory Requirements
- Kestra requires at least **512MB RAM**
- Railway's free tier should work, but might need the Hobby plan ($5/month)
- Monitor memory usage in Railway dashboard

### Alternative Deployment Options

If Railway doesn't work well:

1. **AWS EC2** (Recommended for production)
   - Free tier eligible (t2.medium)
   - See `DEPLOY_BACKEND.md`

2. **DigitalOcean** ($6/month)
   - Simpler than AWS
   - See `DEPLOY_BACKEND.md`

3. **Render** (Free tier available, but limited)
   - Can work but memory constraints
   - See `DEPLOY_BACKEND.md`

## Verification Checklist

- [ ] Push changes to GitHub
- [ ] Configure environment variables in Railway
- [ ] Railway deployment succeeds (check logs)
- [ ] Can access Kestra UI at Railway URL
- [ ] Update Vercel's `KESTRA_URL`
- [ ] Test full workflow from frontend

## Need Help?

- Check Railway logs for errors
- Verify all environment variables are set correctly
- Ensure you have sufficient Railway credits/plan
- Refer to `DEPLOY_RAILWAY.md` for detailed troubleshooting

---

**Status**: ✅ Ready to deploy!
