const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config();

// Parse args
const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : null;
};
const hasArg = (name) => args.includes(name);

const ISSUE_URL = getArg('--issue');
const REPO_URL = getArg('--repo');
const APPLY = hasArg('--apply') || hasArg('--push');
const PUSH = hasArg('--push');
const DRY_RUN = !APPLY;

if (!ISSUE_URL || !REPO_URL) {
    console.error('Usage: node src/orchestrator.js --issue <url> --repo <url> [--apply] [--push]');
    process.exit(1);
}

const WORKSPACE_DIR = 'workspace';

function runCmd(cmd, cwd = process.cwd(), opts = {}) {
    const { exitOnError = true } = opts;
    console.log(`> ${cmd}`);
    try {
        execSync(cmd, { cwd, stdio: 'inherit' });
    } catch (e) {
        if (exitOnError) {
            console.error(`Command failed: ${cmd}`);
            process.exit(1);
        } else {
            throw e;
        }
    }
}

async function fetchIssue(url) {
    // Extract owner/repo/issue_number
    // https://github.com/owner/repo/issues/1#...
    const parts = url.split('github.com/')[1].split('/');
    const owner = parts[0];
    const repo = parts[1];
    const issueNumber = parts[3].split('#')[0]; // Remove fragment

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

    return new Promise((resolve, reject) => {
        const req = https.get(apiUrl, {
            headers: {
                'User-Agent': 'node',
                'Authorization': `token ${process.env.GITHUB_TOKEN}`
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch issue: ${res.statusCode} ${data}`));
                    return;
                }
                const json = JSON.parse(data);
                resolve({
                    number: issueNumber,
                    body: json.body,
                    owner,
                    repo
                });
            });
        });
        req.on('error', reject);
    });
}

async function createPR(owner, repo, branch, issueNumber) {
    const prBodyTemplate = fs.readFileSync(path.join(__dirname, '../prompts/pr_body_template.txt'), 'utf8');
    const body = prBodyTemplate.replace('{{ISSUE_BODY}}', issueNumber);

    const data = JSON.stringify({
        title: `fix: resolve issue #${issueNumber}`,
        body: body,
        head: branch,
        base: 'main'
    });

    return new Promise((resolve, reject) => {
        const req = https.request(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            headers: {
                'User-Agent': 'node',
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let respData = '';
            res.on('data', c => respData += c);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    console.log('✅ PR Created:', JSON.parse(respData).html_url);
                    resolve();
                } else {
                    console.error('❌ Failed to create PR:', respData);
                    resolve(); // Don't crash
                }
            });
        });
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 Starting AI Issue Autofix (Node.js Orchestrator)...');
    console.log(`Issue: ${ISSUE_URL}`);
    console.log(`Repo: ${REPO_URL}`);
    console.log(`Mode: ${DRY_RUN ? 'Dry Run' : 'Live'}`);

    if (!process.env.GITHUB_TOKEN) {
        console.error('Error: GITHUB_TOKEN not set in .env');
        process.exit(1);
    }

    // 1. Fetch Issue
    console.log('⬇️ Fetching issue...');
    const issue = await fetchIssue(ISSUE_URL);
    console.log('✅ Issue fetched.');

    // 2. Clone Repo
    console.log('⬇️ Cloning repository...');
    if (fs.existsSync(WORKSPACE_DIR)) {
        fs.rmSync(WORKSPACE_DIR, { recursive: true, force: true });
    }
    runCmd(`git clone ${REPO_URL} ${WORKSPACE_DIR}`);

    // 3. Create Branch
    const branchName = `fix/issue-${issue.number}-ai`;
    console.log(`🌿 Creating branch ${branchName}...`);
    runCmd(`git checkout -b ${branchName}`, WORKSPACE_DIR);

    // Configure Git to use token for authentication
    console.log('🔐 Configuring Git authentication...');

    // Debug: Check if token is available
    const tokenPresent = process.env.GITHUB_TOKEN ? 'YES' : 'NO';
    const tokenLength = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.length : 0;
    const tokenPrefix = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.substring(0, 7) : 'NONE';
    console.log(`Token present: ${tokenPresent}, Length: ${tokenLength}, Prefix: ${tokenPrefix}...`);

    // Extract repo owner and name from URL
    const repoMatch = REPO_URL.match(/github\.com\/(.+?)\/(.+?)(\.git)?$/);
    if (repoMatch) {
        const owner = repoMatch[1];
        const repo = repoMatch[2].replace('.git', '');

        // URL-encode the token to handle special characters
        const encodedToken = encodeURIComponent(process.env.GITHUB_TOKEN);
        const authenticatedUrl = `https://${encodedToken}@github.com/${owner}/${repo}.git`;

        console.log(`Setting remote URL with encoded token (length: ${encodedToken.length})`);
        runCmd(`git remote set-url origin "${authenticatedUrl}"`, WORKSPACE_DIR);

        // Verify the remote was set correctly
        console.log('Verifying remote URL...');
        runCmd(`git remote -v`, WORKSPACE_DIR);
    }





    // 4. Run Agent
    console.log('🤖 Running Cline Agent...');

    // Try Docker first
    // Try Docker first
    let useDocker = false;
    try {
        execSync('docker info', { stdio: 'ignore' });
        useDocker = true;
    } catch (e) {
        console.warn('⚠️ Docker not found or not running. Falling back to local execution.');
        useDocker = false;
    }

    if (useDocker) {
        console.log('🐳 Docker is available. Building and running container...');
        try {
            runCmd('docker build -t cline-agent -f docker/cline-agent/Dockerfile .');

            const workspaceAbs = path.resolve(WORKSPACE_DIR);
            // Use a distinct internal path to avoid any MSYS/Git Bash conversion confusion
            const internalMount = '/mnt/workspace';

            // We need to pass the issue body. It might contain special chars.
            // Best to pass it as a file mounted in, or base64 encoded, or just careful quoting.
            // For this MVP, let's write it to a file in the workspace so the container can read it easily.
            // But wait, the agent expects --issue-body as a string.
            // Let's just escape it carefully.

            const isWindows = process.platform === 'win32';
            // On Windows, we need to be careful with volume mounting syntax if using Git Bash vs Cmd
            // Since we are in Node execSync, we are likely in Cmd or Powershell unless specified.
            // Docker Desktop for Windows handles "C:\Users...":/mnt/workspace fine.

            const mountArg = `"${workspaceAbs}":/mnt/workspace`;
            const repoPathArg = '/mnt/workspace';

            // Escape quotes in issue body
            const escapedBody = issue.body.replace(/"/g, '\\"').replace(/`/g, '\\`');

            runCmd(`docker run --rm -v ${mountArg} -e OPENAI_API_KEY=${process.env.OPENAI_API_KEY} cline-agent --issue-body "${escapedBody}" --repo-path ${repoPathArg}`);

        } catch (e) {
            console.error('❌ Docker execution failed:', e.message);
            console.log('⚠️ Falling back to local execution...');
            useDocker = false;
        }
    }

    if (!useDocker) {
        console.log('⚠️ Running agent locally...');
        // We are in src/orchestrator.js, agent is in src/agent.js
        const agentPath = path.join(__dirname, 'agent.js');
        // workspace dir relative to here
        const workspacePath = path.resolve(WORKSPACE_DIR);

        // Call agent.js
        const issueBodyFile = path.join(__dirname, '../temp_issue_body.txt');
        fs.writeFileSync(issueBodyFile, issue.body);

        runCmd(`node "${agentPath}" --issue-body "${issue.body.replace(/"/g, '\\"')}" --repo-path "${workspacePath}"`);
        if (fs.existsSync(issueBodyFile)) fs.unlinkSync(issueBodyFile);
    }

    // Check patch
    const patchPath = path.join(WORKSPACE_DIR, 'patch.diff');
    if (fs.existsSync(patchPath)) {
        console.log(`✨ Patch generated at ${patchPath}`);
    } else {
        console.error('❌ No patch generated.');
        process.exit(1);
    }

    // 5. Apply
    if (APPLY) {
        console.log('🔧 Applying patch...');
        try {
            runCmd('git apply --ignore-space-change --ignore-whitespace patch.diff', WORKSPACE_DIR, { exitOnError: false });
        } catch (e) {
            console.warn('⚠️ Standard git apply failed, trying with reduced context (-C1)...');
            try {
                runCmd('git apply --ignore-space-change --ignore-whitespace -C1 patch.diff', WORKSPACE_DIR, { exitOnError: false });
            } catch (e2) {
                console.warn('⚠️ Apply with -C1 failed, trying with no context (-C0)...');
                try {
                    runCmd('git apply --ignore-space-change --ignore-whitespace -C0 patch.diff', WORKSPACE_DIR, { exitOnError: false });
                } catch (e3) {
                    console.warn('⚠️ Apply with -C0 failed, trying with --reject...');
                    try {
                        runCmd('git apply --reject --ignore-space-change --ignore-whitespace patch.diff', WORKSPACE_DIR, { exitOnError: false });
                    } catch (e4) {
                        console.error('❌ Failed to apply patch even with --reject.');
                        console.error('--- Patch Content ---');
                        console.error(fs.readFileSync(path.join(WORKSPACE_DIR, 'patch.diff'), 'utf8'));
                        console.error('---------------------');
                        process.exit(1);
                    }
                }
            }
        }

        // Tests with iterative refinement
        if (fs.existsSync(path.join(WORKSPACE_DIR, 'package.json'))) {
            console.log('🧪 Running tests...');

            const maxTestRetries = 2;
            let testsPassed = false;

            for (let testAttempt = 1; testAttempt <= maxTestRetries; testAttempt++) {
                try {
                    runCmd('npm install', WORKSPACE_DIR, { exitOnError: false });
                    const testOutput = runCmd('npm test', WORKSPACE_DIR);
                    console.log('✅ Tests passed!');
                    testsPassed = true;
                    break;
                } catch (e) {
                    console.warn(`⚠️ Tests failed (attempt ${testAttempt}/${maxTestRetries})`);

                    if (testAttempt < maxTestRetries) {
                        console.log('🔄 Attempting to fix test failures...');

                        // Read test failure output
                        const testOutput = e.stdout ? e.stdout.toString() : e.message;

                        // Use test_failure_prompt to generate a fix
                        const testFailurePrompt = fs.readFileSync(
                            path.join(__dirname, '../prompts/test_failure_prompt.txt'),
                            'utf8'
                        );

                        const refinedPrompt = testFailurePrompt
                            .replace('{{TEST_OUTPUT}}', testOutput)
                            .replace('{{ISSUE_BODY}}', issueBody)
                            .replace('{{CODEBASE}}', readRepo(WORKSPACE_DIR).map(f =>
                                `File: ${f.path}\nContent:\n${f.content}\n`
                            ).join('\n---\n'));

                        // Call agent again with test failure context
                        console.log('Calling AI to fix test failures...');
                        // For now, we'll skip the retry to avoid complexity
                        // In production, you'd call the agent again here
                        console.warn('Test refinement not implemented yet - continuing...');
                    }
                }
            }

            if (!testsPassed) {
                console.warn('⚠️ Tests did not pass after all attempts, but continuing...');
            }
        }

        // 6. Push & PR
        if (PUSH) {
            console.log('⬆️ Pushing branch...');
            runCmd('git add .', WORKSPACE_DIR);
            runCmd(`git commit -m "fix: resolve issue #${issue.number}"`, WORKSPACE_DIR);
            runCmd(`git push --force origin ${branchName}`, WORKSPACE_DIR);

            console.log('📝 Creating PR...');
            await createPR(issue.owner, issue.repo, branchName, issue.number);
        }
    } else {
        console.log('ℹ️ Dry run finished. Patch not applied.');
    }

    console.log('🎉 Done.');
}

main();
