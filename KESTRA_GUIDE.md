# Kestra Integration Guide

## 🎯 Overview

This guide explains how to integrate Kestra as the orchestration layer for the AI Issue Autofix MVP. Kestra will manage workflow execution, scheduling, and provide an API for your future UI.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Your `.env` file configured with:
  - `OPENAI_API_KEY` (or OpenRouter/Cerebras key)
  - `GITHUB_TOKEN`

## 🚀 Quick Start

### 1. Start Kestra

```bash
# Start Kestra and PostgreSQL
docker-compose -f docker-compose.kestra.yml up -d

# Check status
docker-compose -f docker-compose.kestra.yml ps

# View logs
docker-compose -f docker-compose.kestra.yml logs -f kestra
```

### 2. Access Kestra UI

Open your browser and navigate to:
```
http://localhost:8080
```

### 3. Configure Secrets

In Kestra UI, go to **Settings** → **Secrets** and add:

- `OPENAI_API_KEY`: Your OpenAI/OpenRouter/Cerebras API key
- `GITHUB_TOKEN`: Your GitHub Personal Access Token

### 4. Deploy Workflows

The workflows are automatically loaded from `kestra/workflows/`:

1. **ai-issue-autofix.yml** - Single issue fixing
2. **batch-issue-autofix.yml** - Batch processing

You can also manually upload them via the UI:
- Go to **Flows** → **Create**
- Copy the YAML content
- Click **Save**

## 📖 Usage

### Option 1: Via Kestra UI

1. Go to **Flows** → **dev.autofix** → **ai-issue-autofix**
2. Click **Execute**
3. Fill in the inputs:
   - `issue_url`: GitHub issue URL
   - `repo_url`: Repository URL
   - `apply_fix`: true/false
   - `create_pr`: true/false
4. Click **Execute**

### Option 2: Via Kestra API

```bash
# Execute workflow via API
curl -X POST http://localhost:8080/api/v1/executions/dev.autofix/ai-issue-autofix \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "issue_url": "https://github.com/JS-Aakash/Test/issues/3",
      "repo_url": "https://github.com/JS-Aakash/Test.git",
      "apply_fix": true,
      "create_pr": true
    }
  }'
```

### Option 3: Via CLI (for testing)

```bash
# Still works directly
./run_with_cline.sh --issue <url> --repo <url> --push
```

## 🔄 Workflows Explained

### 1. Single Issue Autofix (`ai-issue-autofix.yml`)

**Purpose**: Fix a single GitHub issue

**Inputs**:
- `issue_url` (required): GitHub issue URL
- `repo_url` (required): Repository URL
- `apply_fix` (optional): Apply the patch (default: false)
- `create_pr` (optional): Create a PR (default: false)

**Tasks**:
1. Validate inputs
2. Setup workspace
3. Run autofix script
4. Store patch as artifact
5. Cleanup
6. Notify completion

**Outputs**:
- Patch file stored in Kestra storage
- Execution logs

### 2. Batch Issue Autofix (`batch-issue-autofix.yml`)

**Purpose**: Process multiple issues from a repository

**Inputs**:
- `repo_url` (required): Repository URL
- `issue_labels` (optional): Filter by labels (default: "bug")
- `max_issues` (optional): Max issues to process (default: 5)
- `create_prs` (optional): Create PRs (default: false)

**Tasks**:
1. Extract repo info
2. Fetch open issues from GitHub
3. Process each issue (calls ai-issue-autofix)
4. Generate execution report

**Triggers**:
- Scheduled: Every 6 hours (disabled by default)
- Manual: Via UI or API

## 🔌 API Integration (For Your Future UI)

### Execute Workflow

```javascript
// Example: Trigger autofix from your UI
async function triggerAutofix(issueUrl, repoUrl, createPR = false) {
  const response = await fetch('http://localhost:8080/api/v1/executions/dev.autofix/ai-issue-autofix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        issue_url: issueUrl,
        repo_url: repoUrl,
        apply_fix: true,
        create_pr: createPR
      }
    })
  });
  
  const execution = await response.json();
  return execution.id; // Use this to track execution
}
```

### Check Execution Status

```javascript
async function checkExecutionStatus(executionId) {
  const response = await fetch(`http://localhost:8080/api/v1/executions/${executionId}`);
  const execution = await response.json();
  return execution.state.current; // SUCCESS, RUNNING, FAILED
}
```

### Download Patch

```javascript
async function downloadPatch(executionId) {
  const response = await fetch(`http://localhost:8080/api/v1/executions/${executionId}/file?path=patch.diff`);
  const patch = await response.text();
  return patch;
}
```

## 📊 Monitoring

### View Executions

- Go to **Executions** in Kestra UI
- Filter by flow, status, date
- View logs, outputs, and artifacts

### Metrics

Kestra provides built-in metrics:
- Execution count
- Success/failure rate
- Execution duration
- Resource usage

## 🔧 Configuration

### Environment Variables

Edit `docker-compose.kestra.yml` to customize:

```yaml
environment:
  KESTRA_CONFIGURATION: |
    kestra:
      server:
        basic-auth:
          enabled: true  # Enable authentication
          username: admin
          password: admin
```

### Workflow Variables

Edit workflow files to customize:
- Workspace directory
- Script paths
- Timeout values
- Retry logic

## 🎨 Future UI Integration

### Architecture

```
┌─────────────┐
│   Your UI   │
│  (React/    │
│   Next.js)  │
└──────┬──────┘
       │ HTTP API
       ▼
┌─────────────┐
│   Kestra    │
│   Server    │
└──────┬──────┘
       │ Execute
       ▼
┌─────────────┐
│  AI Autofix │
│   Script    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   GitHub    │
└─────────────┘
```

### UI Features to Build

1. **Dashboard**
   - List repositories
   - Show open issues
   - Display fix status

2. **Issue List**
   - Filter by labels
   - Select issues to fix
   - Batch operations

3. **Execution Monitor**
   - Real-time status
   - View logs
   - Download patches

4. **Settings**
   - Configure API keys
   - Set preferences
   - Manage repositories

## 🐛 Troubleshooting

### Kestra won't start

```bash
# Check logs
docker-compose -f docker-compose.kestra.yml logs kestra

# Restart services
docker-compose -f docker-compose.kestra.yml restart
```

### Workflow fails

1. Check execution logs in Kestra UI
2. Verify secrets are configured
3. Check file paths in workflow
4. Ensure Docker has access to project directory

### Can't access UI

```bash
# Check if port 8080 is available
netstat -an | grep 8080

# Try different port
# Edit docker-compose.kestra.yml: "8090:8080"
```

## 📚 Next Steps

1. ✅ Start Kestra
2. ✅ Configure secrets
3. ✅ Test single issue workflow
4. ✅ Test batch workflow
5. 🔄 Build your UI
6. 🔄 Integrate with Kestra API
7. 🔄 Add authentication
8. 🔄 Deploy to production

## 🔗 Resources

- [Kestra Documentation](https://kestra.io/docs)
- [Kestra API Reference](https://kestra.io/docs/api-reference)
- [Kestra Examples](https://github.com/kestra-io/examples)

## 💡 Tips

- Use **dry-run mode** (`apply_fix: false`) for testing
- Enable **scheduled triggers** only after thorough testing
- Monitor **execution logs** for debugging
- Use **Kestra secrets** for sensitive data
- Set up **notifications** (Slack, email) for failures
