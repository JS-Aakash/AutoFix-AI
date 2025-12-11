# 🤖 AI Issue Autofix MVP

An intelligent, automated system that uses AI to analyze GitHub issues, generate fixes, apply patches, run tests, and create pull requests—all orchestrated through Kestra workflows.

## 🌟 Features

- **AI-Powered Analysis**: Uses OpenAI, OpenRouter, or Cerebras to understand issues and generate fixes
- **Automated Workflow**: Kestra orchestration for reliable, scalable execution
- **Smart Patching**: Generates and applies patches with multiple fallback strategies
- **Test Generation**: Automatically creates test files if they don't exist
- **Pull Request Creation**: Automatically creates PRs with detailed descriptions
- **Multi-Provider Support**: Works with OpenAI, OpenRouter (Gemini), and Cerebras
- **Docker Integration**: Containerized execution for consistency
- **Future-Ready**: API-first design for easy UI integration

## 🏗️ Architecture

### Components

1. **Kestra Workflows** (`kestra/workflows/`)
   - Orchestrates the entire autofix process
   - Provides REST API for external integrations
   - Handles scheduling and batch processing

2. **Orchestrator** (`src/orchestrator.js`)
   - Node.js script that manages the fix workflow
   - Clones repositories, creates branches
   - Coordinates agent execution and patch application

3. **AI Agent** (`src/agent.js`)
   - Interacts with LLM APIs
   - Generates full file content based on issues
   - Creates git-compatible patches

4. **Prompts** (`prompts/`)
   - `fix_prompt.txt`: Instructions for generating fixes
   - `test_failure_prompt.txt`: Instructions for fixing test failures
   - `pr_body_template.txt`: Template for PR descriptions

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+ (for local development)
- GitHub Personal Access Token with `repo` permissions
- OpenAI/OpenRouter/Cerebras API key

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd ai-issue-autofix-mvp
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
OPENAI_API_KEY=sk-or-v1-...  # OpenRouter key
# OR
OPENAI_API_KEY=sk-...         # OpenAI key
# OR
OPENAI_API_KEY=csk-...        # Cerebras key

GITHUB_TOKEN=github_pat_...   # GitHub PAT with repo access
```

### 3. Start Kestra

```bash
# Build custom Kestra image with Node.js
docker-compose -f docker-compose.kestra.yml build

# Start Kestra and PostgreSQL
docker-compose -f docker-compose.kestra.yml up -d

# Check logs
docker-compose -f docker-compose.kestra.yml logs -f kestra
```

### 4. Access Kestra UI

Open: **http://localhost:8080**

### 5. Upload Workflow

1. Go to **Flows** → **+ Create**
2. Copy content from `kestra/workflows/ai-issue-autofix.yml`
3. Paste and click **Save**

### 6. Execute Workflow

1. Click **Execute**
2. Fill in inputs:
   ```
   issue_url: https://github.com/owner/repo/issues/123
   repo_url: https://github.com/owner/repo.git
   openai_api_key: <your-api-key>
   github_token: <your-github-token>
   apply_fix: true
   create_pr: true
   ```
3. Click **Execute**
4. Watch the logs!

## 📖 Usage

### Via Kestra UI

1. Navigate to your workflow
2. Click **Execute**
3. Provide required inputs
4. Monitor execution in real-time

### Via Kestra API

```bash
curl -X POST http://localhost:8080/api/v1/executions/dev.autofix/ai-issue-autofix \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "issue_url": "https://github.com/owner/repo/issues/123",
      "repo_url": "https://github.com/owner/repo.git",
      "openai_api_key": "sk-...",
      "github_token": "github_pat_...",
      "apply_fix": true,
      "create_pr": true
    }
  }'
```

### Via CLI (Direct)

```bash
./run_with_cline.sh --issue <issue-url> --repo <repo-url> --push
```

## 🔧 Configuration

### Workflow Modes

1. **Dry Run** (default)
   ```
   apply_fix: false
   create_pr: false
   ```
   - Only generates the patch
   - No changes applied

2. **Apply Only**
   ```
   apply_fix: true
   create_pr: false
   ```
   - Generates and applies patch
   - No PR created

3. **Full Auto**
   ```
   apply_fix: true
   create_pr: true
   ```
   - Generates, applies, and creates PR
   - Complete automation

### LLM Providers

The system automatically detects the provider based on API key prefix:

- **OpenRouter**: `sk-or-v1-...` → Uses `google/gemini-2.0-flash-exp:free`
- **Cerebras**: `csk-...` → Uses `llama3.1-8b`
- **OpenAI**: `sk-...` → Uses `gpt-4o`

## 📁 Project Structure

```
ai-issue-autofix-mvp/
├── src/
│   ├── orchestrator.js       # Main workflow orchestrator
│   └── agent.js               # AI agent for fix generation
├── kestra/
│   └── workflows/
│       ├── ai-issue-autofix.yml      # Single issue workflow
│       └── batch-issue-autofix.yml   # Batch processing workflow
├── docker/
│   ├── cline-agent/           # Docker image for agent
│   └── kestra/                # Custom Kestra image with Node.js
├── prompts/
│   ├── fix_prompt.txt         # AI instructions for fixes
│   ├── test_failure_prompt.txt
│   └── pr_body_template.txt
├── docker-compose.kestra.yml  # Kestra setup
├── run_with_cline.sh          # CLI wrapper
└── package.json               # Node.js dependencies
```

## 🎯 Workflow Process

1. **Fetch Issue**: Retrieves issue details from GitHub API
2. **Clone Repository**: Clones the target repository
3. **Create Branch**: Creates a new branch for the fix
4. **AI Analysis**: Sends codebase + issue to LLM
5. **Generate Fix**: LLM outputs complete fixed files
6. **Create Patch**: Generates git diff from changes
7. **Apply Patch**: Applies patch with fallback strategies
8. **Run Tests**: Executes tests if available
9. **Commit Changes**: Creates a commit with the fix
10. **Push & PR**: Pushes branch and creates pull request

## 🔌 API Integration (For Future UI)

### Trigger Workflow

```javascript
const response = await fetch('http://localhost:8080/api/v1/executions/dev.autofix/ai-issue-autofix', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: {
      issue_url: issueUrl,
      repo_url: repoUrl,
      openai_api_key: apiKey,
      github_token: token,
      apply_fix: true,
      create_pr: true
    }
  })
});

const { id } = await response.json();
```

### Check Status

```javascript
const status = await fetch(`http://localhost:8080/api/v1/executions/${id}`);
const execution = await status.json();
console.log(execution.state.current); // SUCCESS, RUNNING, FAILED
```

### Download Patch

```javascript
const patch = await fetch(`http://localhost:8080/api/v1/executions/${id}/file?path=patch.diff`);
const patchContent = await patch.text();
```

## 🐛 Troubleshooting

### Kestra Won't Start

```bash
# Check logs
docker-compose -f docker-compose.kestra.yml logs kestra

# Restart
docker-compose -f docker-compose.kestra.yml restart
```

### Workflow Fails

1. Check execution logs in Kestra UI
2. Verify API keys are correct
3. Ensure GitHub token has `repo` permissions
4. Check if repository is accessible

### Git Push Fails

- Verify GitHub token has write permissions
- Check if token is expired
- Ensure repository exists and you have access

### Tests Fail

- The AI generates tests based on the project type
- Tests use Node.js `assert` module by default
- Test failures don't stop the workflow

## 📚 Documentation

- **[KESTRA_GUIDE.md](KESTRA_GUIDE.md)**: Detailed Kestra integration guide
- **[KESTRA_SETUP.md](KESTRA_SETUP.md)**: Step-by-step setup instructions
- **[run-local.md](run-local.md)**: Local testing guide

## 🛣️ Roadmap

### Current (MVP)
- ✅ AI-powered fix generation
- ✅ Kestra orchestration
- ✅ Automated PR creation
- ✅ Multi-provider LLM support

### Planned
- 🔄 Web UI dashboard
- 🔄 Multi-repository support
- 🔄 Iterative fix refinement
- 🔄 Advanced metrics and analytics
- 🔄 Slack/Discord notifications
- 🔄 Multi-language support (Python, Java, Go)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Kestra for workflow orchestration
- OpenAI, OpenRouter, and Cerebras for LLM APIs
- GitHub for the platform and API

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Check the documentation
- Review Kestra logs

---

**Built with ❤️ for automated software maintenance**
