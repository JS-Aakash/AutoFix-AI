const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { execSync } = require('child_process');
require('dotenv').config();

const apiKey = process.env.OPENAI_API_KEY;
const isOpenRouter = apiKey && apiKey.startsWith('sk-or-');
const isCerebras = apiKey && apiKey.startsWith('csk-');

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' :
        isCerebras ? 'https://api.cerebras.ai/v1' : undefined,
    defaultHeaders: isOpenRouter ? {
        'HTTP-Referer': 'https://github.com/cline/cline',
        'X-Title': 'Cline Agent'
    } : undefined
});

async function main() {
    const args = process.argv.slice(2);
    const issueBodyIndex = args.indexOf('--issue-body');
    const repoPathIndex = args.indexOf('--repo-path');

    if (issueBodyIndex === -1 || repoPathIndex === -1) {
        console.error('Usage: node agent.js --issue-body <text> --repo-path <path>');
        process.exit(1);
    }

    const issueBody = args[issueBodyIndex + 1];
    const repoPath = args[repoPathIndex + 1];

    console.log(`Analyzing issue for repo at: ${repoPath}`);

    // 1. Read codebase
    const files = readRepo(repoPath);
    const codebaseContext = files.map(f => `File: ${f.path}\nContent:\n${f.content}\n`).join('\n---\n');

    // 2. Read prompt template
    const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/fix_prompt.txt'), 'utf8');
    const prompt = promptTemplate
        .replace('{{ISSUE_BODY}}', issueBody)
        .replace('{{CODEBASE}}', codebaseContext);

    // 3. Call OpenAI with retry logic and JSON mode
    let responseData = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxRetries}: Calling AI...`);

            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: isOpenRouter ? 'google/gemini-2.0-flash-exp:free' :
                    isCerebras ? 'llama3.1-8b' : 'gpt-4o',
                response_format: { type: "json_object" },
                max_tokens: 4000,
                temperature: 0.3,
            });

            const responseContent = completion.choices[0].message.content;

            // Parse JSON response
            try {
                responseData = JSON.parse(responseContent);

                // Validate response
                if (validateResponse(responseData)) {
                    console.log('✅ AI response validated successfully');
                    break;
                } else {
                    console.warn(`⚠️ AI response validation failed (attempt ${attempt}/${maxRetries})`);
                    if (attempt === maxRetries) {
                        console.error('❌ Failed to get valid response after all retries');
                        console.error('Response:', responseContent);
                        process.exit(1);
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (parseError) {
                console.error(`JSON parse error on attempt ${attempt}:`, parseError.message);
                if (attempt === maxRetries) {
                    console.error('Failed to parse JSON response');
                    console.error('Response:', responseContent);
                    process.exit(1);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error.message);
            if (attempt === maxRetries) {
                console.error('Error calling OpenAI:', error);
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // 4. Generate diffs from JSON response
    const diffs = [];
    const filesToProcess = responseData.files || [];

    console.log(`Processing ${filesToProcess.length} file(s)...`);

    for (const fileData of filesToProcess) {
        const filePathRelative = fileData.path;
        const newContent = fileData.content;

        console.log(`Processing: ${filePathRelative}`);

        const originalFilePath = path.join(repoPath, filePathRelative);
        const tempFilePath = path.join(repoPath, `${filePathRelative}.new`);

        if (fs.existsSync(originalFilePath)) {
            // File exists - generate a diff
            fs.writeFileSync(tempFilePath, newContent);

            try {
                // Generate diff using git
                try {
                    execSync(`git diff --no-index --ignore-space-at-eol "${filePathRelative}" "${filePathRelative}.new"`, { cwd: repoPath });
                } catch (e) {
                    // git diff exits with 1 when there is a diff
                    if (e.stdout) {
                        let diffOutput = e.stdout.toString();
                        // Fix the header to look like a standard git patch
                        const escapedPath = filePathRelative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        diffOutput = diffOutput.replace(new RegExp(`b/${escapedPath}.new`, 'g'), `b/${filePathRelative}`);
                        diffs.push(diffOutput);
                    }
                }
            } finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        } else {
            // File doesn't exist - create a new file diff
            console.log(`Generating diff for new file: ${filePathRelative}`);

            const lines = newContent.split('\n');
            let diffContent = `diff --git a/${filePathRelative} b/${filePathRelative}\n`;
            diffContent += `new file mode 100644\n`;
            diffContent += `index 0000000..0000000\n`;
            diffContent += `--- /dev/null\n`;
            diffContent += `+++ b/${filePathRelative}\n`;
            diffContent += `@@ -0,0 +1,${lines.length} @@\n`;

            for (const line of lines) {
                diffContent += `+${line}\n`;
            }

            diffs.push(diffContent);
        }
    }

    if (diffs.length > 0) {
        const fullPatch = diffs.join('\n');
        const patchPath = path.join(repoPath, 'patch.diff');
        fs.writeFileSync(patchPath, fullPatch);
        console.log(`✅ Patch written to ${patchPath}`);
        console.log(`📝 Modified ${diffs.length} file(s)`);
    } else {
        console.error('❌ No changes detected');
        console.log('Response:', JSON.stringify(responseData, null, 2));
        process.exit(1);
    }
}

// Validation function for JSON response
function validateResponse(data) {
    if (!data || typeof data !== 'object') {
        console.warn('Validation failed: Response is not an object');
        return false;
    }

    if (!Array.isArray(data.files)) {
        console.warn('Validation failed: No files array found');
        return false;
    }

    if (data.files.length === 0) {
        console.warn('Validation failed: Files array is empty');
        return false;
    }

    console.log(`Found ${data.files.length} file(s) in response`);

    // Validate each file
    for (const file of data.files) {
        if (!file.path || typeof file.path !== 'string') {
            console.warn('Validation failed: File missing path');
            return false;
        }

        if (!file.content || typeof file.content !== 'string') {
            console.warn(`Validation failed: File ${file.path} missing content`);
            return false;
        }

        if (file.content.length < 10) {
            console.warn(`Validation failed: File ${file.path} has insufficient content`);
            return false;
        }

        // Check for placeholder filenames
        if (file.path.includes('<') || file.path.includes('>') ||
            file.path.includes('path/to') || file.path.endsWith('.ext')) {
            console.warn(`Validation failed: Placeholder filename detected: ${file.path}`);
            return false;
        }

        console.log(`  ✓ ${file.path} (${file.content.length} chars)`);
    }

    return true;
}

function readRepo(dir, fileList = [], rootDir = dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== '.git' && file !== 'node_modules') {
                readRepo(filePath, fileList, rootDir);
            }
        } else {
            // Skip package-lock.json and patch.diff
            if (file === 'package-lock.json' || file === 'patch.diff') {
                continue;
            }
            // Simple filter for text files
            if (['.js', '.ts', '.md', '.json', '.html', '.css', '.txt'].includes(path.extname(file))) {
                const content = fs.readFileSync(filePath, 'utf8');
                fileList.push({
                    path: path.relative(rootDir, filePath),
                    content: content
                });
            }
        }
    }
    return fileList;
}

main();
