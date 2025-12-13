# ☁️ Deploying Kestra Backend to the Cloud

To run the app without your laptop, you need to host the Backend (Kestra + Docker) on a cloud server (VPS).

## Option 1: AWS EC2 (Free Tier Eligible) 🏆
**Best for:** Free usage (12 months), full control.

### 1. Launch Instance
1.  Log in to AWS Console -> **EC2** -> **Launch Instance**.
2.  **Name**: `AutoFix-Backend`.
3.  **OS**: `Ubuntu Server 24.04 LTS` (or 22.04).
4.  **Instance Type**: `t2.medium` or `t3.medium` (Recommended for AI tasks, though `micro` might work slowly, `medium` is safer for Kestra Java memory).
5.  **Key Pair**: Create a new one (e.g., `autofix-key`) and download the `.pem` file.
6.  **Network Settings**: Check boxes for:
    *   Allow SSH traffic.
    *   Allow HTTP traffic.
    *   Allow HTTPS traffic.

### 2. Connect to Server
Open your terminal (where you saved the key):
```bash
chmod 400 autofix-key.pem
ssh -i "autofix-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

### 3. Install Docker & Git
Copy-paste this block to set up the environment:
```bash
# Update and install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow running docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 4. Deploy Application
```bash
# Clone your repo
git clone https://github.com/JS-Aakash/AutoFix-AI.git
cd AutoFix-AI

# Create .env file
nano .env
# Paste your OPENAI_API_KEY=... here
# Save with Ctrl+X, Y, Enter

# Start Kestra
docker compose -f docker-compose.kestra.yml up -d
```

### 5. Expose Port 8080 (Security Group)
By default, AWS blocks port 8080.
1.  Go to AWS Console -> EC2 -> **Instances**.
2.  Click your instance -> **Security** tab -> Click the **Security Group** link.
3.  **Edit inbound rules** -> **Add rule**.
    *   **Type**: `Custom TCP`
    *   **Port range**: `8080`
    *   **Source**: `0.0.0.0/0` (Anywhere)
4.  Save rules.

### 6. Connect Vercel to Cloud Backend
1.  Copy your EC2 Public IP (e.g., `1.2.3.4`).
2.  Go to Vercel -> Project Settings -> Environment Variables.
3.  Update `KESTRA_URL` to: `http://1.2.3.4:8080`
4.  Redeploy Vercel.

---

## Option 2: DigitalOcean Droplet ($6/mo)
**Best for:** Simplicity, easier UI.

1.  Create a **Droplet** (Ubuntu 24.04).
2.  Select **Basic** -> **Regular ($6/mo)**.
3.  **Authentication**: SSH Key.
4.  **Create**.
5.  SSH into IP (`ssh root@<IP>`).
6.  Run the same **Step 3 & 4** commands as above.
7.  DigitalOcean usually opens all ports by default, so direct access to `http://<IP>:8080` should work immediately.

---

## Option 3: Render (Free Tier) ⚠️
**Best for:** Zero cost, but **high risk of crash** due to memory limits (512MB) and "Cold Starts" (sleeps after 15mins).

**Warning**: Kestra is a Java app and requires significantly more RAM than Render's free tier provides. **We strongly recommend Option 1 (AWS) or Option 2 (DigitalOcean).** If you proceed, it may be slow or unstable.

### 1. Create Database
1.  Go to [Render Dashboard](https://dashboard.render.com).
2.  Click **New** -> **PostgreSQL**.
3.  **Name**: `kestra-db`.
4.  **Instance Type**: Free.
5.  Create it. Once running, copy the **Internal Connection URL** (e.g., `postgres://kestra:password@host/kestra`).

### 2. Configure Kestra Service
1.  Click **New** -> **Web Service**.
2.  Connect your GitHub Repo.
3.  **Runtime**: Docker.
4.  **Context Directory**: `.` (leave default).
5.  **Dockerfile Path**: `docker/kestra/Dockerfile`.
6.  **Instance Type**: Free.
7.  **Environment Variables**:
    *   `OPENAI_API_KEY`: Your API Key.
    *   `KESTRA_CONFIGURATION`: Copy the block below and replace needed values:

```yaml
micronaut:
  server:
    cors:
      enabled: true
      configurations:
        web:
          allowedOrigins: [ "https://YOUR-VERCEL-APP-URL.vercel.app" ]
          allowedMethods: [HEAD, GET, POST, PUT, DELETE, OPTIONS]
          allowedHeaders: [Content-Type, Authorization]
          allowCredentials: true
datasources:
  postgres:
    url: jdbc:postgresql://hostname:5432/database_name
    driverClassName: org.postgresql.Driver
    username: your_username
    password: your_password
kestra:
  repository:
    type: postgres
  queue:
    type: postgres
  storage:
    type: local
    local:
      base-path: /app/storage
```
*Note: You must manually convert the Render Postgres URL to the JDBC format above (`jdbc:postgresql://...`).*

### 3. Deploy
Render will build the Docker image and attempt to start. Monitoring the logs is crucial to check for "Out of Memory" errors.

---

## Option 4: Railway (Easiest & Fastest) 🚀
**Best for:** Simplicity (One-click Docker Compose). Costs money after $5 trial.

Railway natively supports `docker-compose`, making it the easiest option to deploy the entire stack at once.

1.  **Sign Up**: Go to [Railway.app](https://railway.app).
2.  **New Project**: Click **New Project** -> **GitHub Repo**.
3.  **Select Repo**: Choose `AutoFix-AI`.
4.  **Configure**:
    *   Railway might try to deploy a generic Dockerfile. Click **Settings**.
    *   **Root Directory**: Leave as `/`.
    *   **Docker Compose File**: Set this to `docker-compose.kestra.yml`.
5.  **Variables**: Go to the **Variables** tab and add:
    *   `OPENAI_API_KEY`: Your key.
    *   `GITHUB_TOKEN`: Your Personal Access Token.
6.  **Public Domain**:
    *   Go to **Settings** -> **Networking**.
    *   Click **Generate Domain**. This gives you a URL like `autofix-ai.up.railway.app`.
7.  **Port**: Ensure Railway is routing traffic to port `8080`.

**Update Vercel**:
Take your Railway URL (e.g., `https://autofix-ai.up.railway.app`), update `KESTRA_URL` in Vercel, and you're done!

---

## ✅ Done!
Your backend is now running on the cloud. You can turn off your laptop. Since Docker handles the environment, the AI Agent will function exactly as it did locally.
