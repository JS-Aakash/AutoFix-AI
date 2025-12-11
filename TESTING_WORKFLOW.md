# 🧪 Testing & Deployment Workflow

## Recommended Approach: Local First, Kestra Later

### Phase 1: Local Testing with `run_with_cline.sh`

Test everything locally before deploying to Kestra. This is faster and easier to debug.

## 🚀 Quick Start: Local Testing

### 1. Setup (One-time)

```bash
# Navigate to project
cd "c:\Users\JS Aakash\Desktop\SDE - AG\ai-issue-autofix-mvp"

# Install dependencies
npm install

# Verify .env file exists with your keys
cat .env
```

Your `.env` should have:
```bash
OPENAI_API_KEY=sk-or-v1-...  # Your API key
GITHUB_TOKEN=github_pat_...  # Your GitHub token
```

### 2. Test with a Simple Issue

#### Test 1: Dry Run (No Changes)

```bash
./run_with_cline.sh \
  --issue "https://github.com/JS-Aakash/Test/issues/3" \
  --repo "https://github.com/JS-Aakash/Test.git"
```

**What this does**:
- ✅ Clones the repository
- ✅ Analyzes the issue
- ✅ Generates a fix
- ✅ Creates `patch.diff`
- ❌ Does NOT apply the patch
- ❌ Does NOT create a PR

**Check the output**:
```bash
# View the generated patch
cat workspace/patch.diff

# Check if it looks correct
```

#### Test 2: Apply Fix Locally

```bash
./run_with_cline.sh \
  --issue "https://github.com/JS-Aakash/Test/issues/3" \
  --repo "https://github.com/JS-Aakash/Test.git" \
  --apply
```

**What this does**:
- ✅ Everything from Test 1
- ✅ Applies the patch
- ✅ Runs tests
- ❌ Does NOT push or create PR

**Check the results**:
```bash
# Go to the workspace
cd workspace

# Check the changes
git status
git diff

# Run tests manually if needed
npm test

# Go back
cd ..
```

#### Test 3: Full Run (Push & PR)

```bash
./run_with_cline.sh \
  --issue "https://github.com/JS-Aakash/Test/issues/3" \
  --repo "https://github.com/JS-Aakash/Test.git" \
  --push
```

**What this does**:
- ✅ Everything from Test 2
- ✅ Commits the changes
- ✅ Pushes to GitHub
- ✅ Creates a Pull Request

**Check GitHub**:
- Go to your repository
- Check the new branch `fix/issue-3-ai`
- Review the Pull Request

### 3. Test Different Scenarios

#### Scenario A: Add a Function

Create a test issue:
```
Title: Add multiply function
Body: Add a multiply function to index.js that multiplies two numbers.
It should handle edge cases like zero and negative numbers.
```

Run:
```bash
./run_with_cline.sh \
  --issue "https://github.com/YOUR_USERNAME/YOUR_REPO/issues/X" \
  --repo "https://github.com/YOUR_USERNAME/YOUR_REPO.git" \
  --apply
```

Check:
```bash
cd workspace
cat index.js      # Should have multiply function
cat test.js       # Should have tests
npm test          # Should pass
cd ..
```

#### Scenario B: Fix a Bug

Create a test issue:
```
Title: Fix add function
Body: The add function returns NaN. It should convert string inputs to numbers.
```

Run and verify the same way.

#### Scenario C: Add UI Element

Create a test issue:
```
Title: Add submit button
Body: Add a submit button to the form in index.html that shows an alert.
```

Run and verify.

### 4. Debug Issues Locally

If something fails:

```bash
# Check orchestrator logs
# (They're printed to console)

# Check agent logs
# (Also printed to console)

# View the generated patch
cat workspace/patch.diff

# Check the AI response
# (Logged during execution)

# Manually inspect the workspace
cd workspace
ls -la
cat <filename>
cd ..
```

### 5. Iterate and Improve

If the fix isn't perfect:

1. **Refine the issue description**
   - Add more details
   - Include examples
   - Specify edge cases

2. **Update prompts** (if needed)
   ```bash
   # Edit the prompts
   code prompts/fix_prompt.txt
   
   # Test again
   ./run_with_cline.sh --issue <url> --repo <url> --apply
   ```

3. **Check validation**
   ```bash
   # Agent will show validation results
   # Look for "✅ AI response validated successfully"
   ```

## 🎯 Phase 2: Deploy to Kestra

Once you've tested locally and everything works, deploy to Kestra for production use.

### 1. Start Kestra

```bash
# Build (first time or after changes)
docker-compose -f docker-compose.kestra.yml build

# Start
docker-compose -f docker-compose.kestra.yml up -d

# Check logs
docker-compose -f docker-compose.kestra.yml logs -f kestra
```

### 2. Upload Workflow

1. Open: **http://localhost:8080**
2. Go to **Flows** → **+ Create**
3. Copy content from `kestra/workflows/ai-issue-autofix.yml`
4. Paste and click **Save**

### 3. Test in Kestra

Execute the workflow with the same issue you tested locally:

```
issue_url: https://github.com/JS-Aakash/Test/issues/3
repo_url: https://github.com/JS-Aakash/Test.git
openai_api_key: <your-key>
github_token: <your-token>
apply_fix: false  # Start with dry run
create_pr: false
```

### 4. Compare Results

The Kestra output should match your local testing:
- Same patch generated
- Same files modified
- Same tests created

### 5. Enable Full Automation

Once verified, enable full automation:

```
apply_fix: true
create_pr: true
```

## 📊 Testing Checklist

### Before Each Test

- [ ] `.env` file has correct API keys
- [ ] GitHub token has repo permissions
- [ ] Issue URL is correct
- [ ] Repository URL is correct
- [ ] `workspace/` directory is clean (or delete it)

### After Each Test

- [ ] Check console output for errors
- [ ] Verify `patch.diff` was created
- [ ] Review patch content
- [ ] Check if tests were generated
- [ ] Verify tests pass (if `--apply` used)
- [ ] Check GitHub for PR (if `--push` used)

### Debugging Checklist

If something fails:

- [ ] Check API key is valid
- [ ] Check GitHub token permissions
- [ ] Check issue URL is accessible
- [ ] Check repository exists
- [ ] Review console logs for errors
- [ ] Check `workspace/patch.diff` exists
- [ ] Verify AI response was validated
- [ ] Check if retry attempts were made

## 🔄 Typical Workflow

### Development Cycle

```bash
# 1. Test locally (dry run)
./run_with_cline.sh --issue <url> --repo <url>

# 2. Review patch
cat workspace/patch.diff

# 3. Test with apply
./run_with_cline.sh --issue <url> --repo <url> --apply

# 4. Check tests
cd workspace && npm test && cd ..

# 5. If good, push
./run_with_cline.sh --issue <url> --repo <url> --push

# 6. Review PR on GitHub

# 7. If all good, deploy to Kestra
docker-compose -f docker-compose.kestra.yml up -d
```

### Production Workflow

```bash
# 1. Kestra is running
docker-compose -f docker-compose.kestra.yml ps

# 2. Execute via UI or API
# (See KESTRA_GUIDE.md for details)

# 3. Monitor in Kestra UI
# http://localhost:8080

# 4. Review PRs on GitHub

# 5. Merge successful fixes
```

## 💡 Pro Tips

### 1. Clean Workspace Between Tests

```bash
# Remove workspace to start fresh
rm -rf workspace

# Or just the patch
rm workspace/patch.diff
```

### 2. Test with Different Issues

Create a test repository with various issues:
- Simple function addition
- Bug fixes
- UI changes
- Multiple file changes

### 3. Monitor API Usage

```bash
# Keep track of API calls
# Each test = 1-3 API calls (with retries)
# Cost: ~$0.01-0.02 per test (GPT-4)
```

### 4. Save Good Patches

```bash
# Save successful patches for reference
cp workspace/patch.diff patches/issue-3-success.diff
```

### 5. Test Failure Scenarios

Intentionally create issues that might fail:
- Vague descriptions
- Complex changes
- Multiple files
- Edge cases

## 🎓 Learning Path

### Week 1: Local Testing
- Test 5-10 different issues locally
- Understand what works and what doesn't
- Tune prompts based on results

### Week 2: Kestra Integration
- Deploy to Kestra
- Test same issues via Kestra
- Compare results with local

### Week 3: Automation
- Set up scheduled runs
- Enable batch processing
- Monitor metrics

### Week 4: Production
- Process real issues
- Review and merge PRs
- Iterate and improve

## 📈 Success Metrics

Track these during testing:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Patch Generation | >90% | Count successful patch.diff files |
| Patch Application | >80% | Count successful `git apply` |
| Test Generation | >90% | Count test files created |
| Test Passing | >70% | Count `npm test` successes |
| PR Creation | >80% | Count PRs created on GitHub |

## 🚨 Common Issues & Solutions

### Issue: "Module not found"

```bash
# Solution: Install dependencies
npm install
```

### Issue: "Permission denied"

```bash
# Solution: Make script executable
chmod +x run_with_cline.sh
```

### Issue: "API key invalid"

```bash
# Solution: Check .env file
cat .env
# Verify key is correct
```

### Issue: "Patch won't apply"

```bash
# Solution: Check workspace is clean
rm -rf workspace
# Try again
```

### Issue: "Tests fail"

```bash
# Solution: Check test output
cd workspace
npm test
# Review errors and refine issue description
```

## 📝 Example Test Session

```bash
# Session 1: Initial test
./run_with_cline.sh \
  --issue "https://github.com/test/repo/issues/1" \
  --repo "https://github.com/test/repo.git"

# Review output
cat workspace/patch.diff

# Session 2: Apply and test
./run_with_cline.sh \
  --issue "https://github.com/test/repo/issues/1" \
  --repo "https://github.com/test/repo.git" \
  --apply

# Check results
cd workspace
npm test
git status
cd ..

# Session 3: Push if good
./run_with_cline.sh \
  --issue "https://github.com/test/repo/issues/1" \
  --repo "https://github.com/test/repo.git" \
  --push

# Check GitHub for PR
```

---

**Bottom Line**: Test everything locally first with `run_with_cline.sh`, then deploy to Kestra for production automation! 🚀
