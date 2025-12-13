# 🚀 Deploying AutoFix AI to Vercel

Since your project uses **Next.js (Frontend)** and **Kestra (Docker Backend)**, we will deploy the frontend to Vercel and tunnel the backend to your local machine (perfect for Hackathon demos).

## Step 1: Push Code to GitHub
Ensure all your latest changes are committed and pushed to your GitHub repository.

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Deploy Frontend on Vercel
1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub Repository.
4.  **Configure Project**:
    *   **Root Directory**: Click "Edit" and select `frontend`.
    *   **Environment Variables**: You MUST add these:
        *   `GITHUB_CLIENT_ID`: Your GitHub OAuth App ID.
        *   `GITHUB_CLIENT_SECRET`: Your GitHub OAuth Secret.
        *   `NEXTAUTH_URL`: Your Vercel domain (e.g., `https://your-app.vercel.app`).
        *   `NEXTAUTH_SECRET`: A random string (generate one with `openssl rand -base64 32`).
        *   `KESTRA_URL`: *We will set this in Step 3*.

5.  Click **Deploy**.

## Step 3: Connect Local Backend (Ngrok)
Since Kestra runs on your laptop, Vercel needs a way to reach it. We use **ngrok**.

1.  **Install Ngrok** (if not installed):
    *   Download from [ngrok.com](https://ngrok.com/download).
2.  **Start the Tunnel**:
    Run this command in a terminal to expose Kestra (port 8080):
    ```bash
    ngrok http 8080
    ```
3.  **Copy the URL**: Ngrok will give you a URL like `https://a1b2-c3d4.ngrok-free.app`.
4.  **Update Vercel**:
    *   Go to your Vercel Project -> **Settings** -> **Environment Variables**.
    *   Add/Edit `KESTRA_URL` with your Ngrok URL.
    *   *Important*: You might need to Redeploy (or just wait a moment) for the env var to take effect.

## Step 4: Update GitHub OAuth
1.  Go to your **GitHub Developer Settings** -> **OAuth Apps**.
2.  Update the **Homepage URL** to your Vercel URL (e.g., `https://autofix-ai.vercel.app`).
3.  Update the **Authorization callback URL** to:
    `https://autofix-ai.vercel.app/api/auth/callback/github`

## ✅ You're Live!
Now anyone with the link can visit your Vercel site. When they click "Auto-Fix", Vercel will talk to Ngrok, which talks to Kestra on your laptop, which runs the AI agent!
