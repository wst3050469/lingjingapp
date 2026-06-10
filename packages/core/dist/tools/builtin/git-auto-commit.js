import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
async function analyzeAndCommit(cwd, options = {}) {
    const result = {
        hasChanges: false,
        changes: [],
        branch: 'unknown',
    };
    const { autoMessage = true, message, addAll = true, excludePatterns = [], requireTests = false, conventionalCommit = true, } = options;
    try {
        const branchOutput = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        result.branch = branchOutput.trim();
        const statusOutput = execSync('git status --porcelain', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (!statusOutput.trim()) {
            return result;
        }
        const lines = statusOutput.trim().split('\n');
        for (const line of lines) {
            const status = line.substring(0, 2).trim();
            const file = line.substring(3);
            const shouldExclude = excludePatterns.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                    return regex.test(file);
                }
                return file.includes(pattern);
            });
            if (!shouldExclude) {
                result.changes.push({ status, file });
            }
        }
        if (result.changes.length === 0) {
            return result;
        }
        result.hasChanges = true;
        if (requireTests) {
            const testFiles = result.changes.filter(c => c.file.includes('.test.') ||
                c.file.includes('.spec.') ||
                c.file.includes('__tests__'));
            const srcFiles = result.changes.filter(c => !c.file.includes('.test.') &&
                !c.file.includes('.spec.') &&
                !c.file.includes('__tests__') &&
                (c.file.endsWith('.ts') || c.file.endsWith('.tsx') || c.file.endsWith('.js')));
            if (srcFiles.length > 0 && testFiles.length === 0) {
                return {
                    ...result,
                    commitMessage: 'Skipped: No test files found for modified source files (requireTests=true)',
                };
            }
        }
        let commitMessage = message;
        if (!commitMessage && autoMessage) {
            const changeTypes = new Map();
            const modifiedFiles = [];
            for (const change of result.changes) {
                const ext = change.file.split('.').pop() || '';
                changeTypes.set(ext, (changeTypes.get(ext) || 0) + 1);
                if (change.status === 'M') {
                    modifiedFiles.push(change.file);
                }
            }
            const changeType = (status) => {
                switch (status) {
                    case 'A': return 'feat';
                    case 'D': return 'refactor';
                    case 'R': return 'refactor';
                    default: return 'fix';
                }
            };
            const primaryStatus = result.changes[0].status;
            let type = changeType(primaryStatus);
            if (conventionalCommit) {
                if (result.changes.some(c => c.file.includes('.test.') || c.file.includes('.spec.'))) {
                    type = 'test';
                }
                else if (result.changes.some(c => c.file.includes('.md') || c.file.includes('docs/'))) {
                    type = 'docs';
                }
                else if (result.changes.some(c => c.file.includes('package.json') || c.file.includes('pnpm-lock.yaml'))) {
                    type = 'chore';
                }
            }
            const scope = (() => {
                const dirs = new Set();
                for (const change of result.changes) {
                    const parts = change.file.split('/');
                    if (parts.length > 1) {
                        dirs.add(parts[0]);
                    }
                }
                if (dirs.size === 1) {
                    return Array.from(dirs)[0];
                }
                return undefined;
            })();
            const shortDesc = modifiedFiles.length > 0
                ? `update ${modifiedFiles[0].split('/').pop()}`
                : `${result.changes.length} file${result.changes.length > 1 ? 's' : ''} changed`;
            if (conventionalCommit) {
                commitMessage = scope
                    ? `${type}(${scope}): ${shortDesc}`
                    : `${type}: ${shortDesc}`;
            }
            else {
                commitMessage = shortDesc;
            }
            commitMessage += '\n\nFiles changed:';
            for (const change of result.changes.slice(0, 10)) {
                commitMessage += `\n- ${change.status} ${change.file}`;
            }
            if (result.changes.length > 10) {
                commitMessage += `\n- ... and ${result.changes.length - 10} more`;
            }
        }
        if (!commitMessage) {
            return result;
        }
        if (addAll) {
            const filesToAdd = result.changes.map(c => c.file);
            execSync(`git add ${filesToAdd.map(f => `"${f}"`).join(' ')}`, {
                cwd,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
        execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const hashOutput = execSync('git rev-parse HEAD', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        result.commitHash = hashOutput.trim().substring(0, 7);
        result.commitMessage = commitMessage;
        return result;
    }
    catch (err) {
        throw new Error(`Git auto-commit failed: ${err.message}`);
    }
}
export const gitAutoCommitTool = {
    name: 'git_auto_commit',
    description: 'Automatically analyze git changes and create a commit with an intelligent commit message. Supports conventional commits format.',
    parameters: {
        type: 'object',
        properties: {
            autoMessage: {
                type: 'boolean',
                description: 'Automatically generate commit message based on changes. Default: true',
            },
            message: {
                type: 'string',
                description: 'Custom commit message (overrides autoMessage)',
            },
            addAll: {
                type: 'boolean',
                description: 'Add all changed files before committing. Default: true',
            },
            excludePatterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'File patterns to exclude from commit (e.g., ["*.log", "dist/"])',
            },
            requireTests: {
                type: 'boolean',
                description: 'Skip commit if source files changed but no test files. Default: false',
            },
            conventionalCommit: {
                type: 'boolean',
                description: 'Use conventional commit format (feat/fix/docs/test/chore). Default: true',
            },
        },
    },
    async execute(args, context) {
        const cwd = context.workingDirectory || process.cwd();
        try {
            if (!existsSync(join(cwd, '.git'))) {
                return {
                    content: 'Error: Not a git repository',
                    isError: true,
                };
            }
            const result = await analyzeAndCommit(cwd, {
                autoMessage: args.autoMessage !== false,
                message: args.message,
                addAll: args.addAll !== false,
                excludePatterns: args.excludePatterns || [],
                requireTests: args.requireTests || false,
                conventionalCommit: args.conventionalCommit !== false,
            });
            let output = `## Git Auto-Commit Result\n\n`;
            output += `- **Branch**: ${result.branch}\n`;
            output += `- **Has Changes**: ${result.hasChanges}\n`;
            if (result.changes.length > 0) {
                output += `- **Changes**: ${result.changes.length} files\n\n`;
                output += `### Changed Files\n`;
                for (const change of result.changes) {
                    output += `- [${change.status}] ${change.file}\n`;
                }
                output += '\n';
            }
            if (result.commitHash) {
                output += `### Commit Created\n`;
                output += `- **Hash**: ${result.commitHash}\n`;
                output += `- **Message**:\n\`\`\`\n${result.commitMessage}\n\`\`\`\n`;
            }
            else if (result.commitMessage) {
                output += `\n${result.commitMessage}\n`;
            }
            else if (!result.hasChanges) {
                output += `\nNo changes to commit.\n`;
            }
            return {
                content: output,
                isError: false,
            };
        }
        catch (err) {
            return {
                content: `Git auto-commit failed: ${err.message}`,
                isError: true,
            };
        }
    },
};
//# sourceMappingURL=git-auto-commit.js.map