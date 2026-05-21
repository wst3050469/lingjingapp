// Code Review Tool - 代码审查工具
// 收集审查上下文，调用 sub-agent 执行审查，解析结果为结构化报告
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { fixGbkString } from '../../utils/encoding.js';
const execAsync = promisify(exec);
// --- 依赖注入 ---
let _subAgentExecute = null;
export function initCodeReviewTool(subAgentExecute) {
    _subAgentExecute = subAgentExecute;
}
// --- 上下文收集函数 ---
async function collectDiffContext(workingDir) {
    try {
        const { stdout } = await execAsync('git diff --cached && git diff', {
            cwd: workingDir,
            maxBuffer: 1024 * 1024 * 5, // 5MB
        });
        return stdout || 'No changes detected in working directory.';
    }
    catch (error) {
        const msg = error instanceof Error ? fixGbkString(error.stderr || error.message) : String(error);
        return `Error collecting diff: ${msg}`;
    }
}
async function collectFileContext(filePath, workingDir) {
    try {
        const absolutePath = filePath.startsWith('/') || filePath.includes(':')
            ? filePath
            : `${workingDir}/${filePath}`;
        const content = readFileSync(absolutePath, 'utf-8');
        return `File: ${absolutePath}\n\n\`\`\`\n${content}\n\`\`\``;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error reading file: ${msg}`;
    }
}
async function collectPRContext(prIdentifier, workingDir) {
    try {
        // 尝试使用 gh CLI 获取 PR diff
        const { stdout } = await execAsync(`gh pr diff ${prIdentifier}`, {
            cwd: workingDir,
            maxBuffer: 1024 * 1024 * 5,
        });
        return stdout || `PR #${prIdentifier} not found or no diff available.`;
    }
    catch (error) {
        const msg = error instanceof Error ? fixGbkString(error.stderr || error.message) : String(error);
        return `Error collecting PR diff: ${msg}. Make sure GitHub CLI (gh) is installed and authenticated.`;
    }
}
async function collectProjectContext(workingDir) {
    try {
        // 获取项目结构概览
        const { stdout: treeOutput } = await execAsync('find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" | head -100', { cwd: workingDir });
        // 读取关键配置文件
        let packageJson = '';
        let tsConfig = '';
        try {
            packageJson = readFileSync(`${workingDir}/package.json`, 'utf-8');
        }
        catch { }
        try {
            tsConfig = readFileSync(`${workingDir}/tsconfig.json`, 'utf-8');
        }
        catch { }
        return `Project Structure (first 100 code files):\n${treeOutput}\n\n` +
            `package.json:\n\`\`\`json\n${packageJson}\n\`\`\`\n\n` +
            `tsconfig.json:\n\`\`\`json\n${tsConfig}\n\`\`\``;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Error collecting project context: ${msg}`;
    }
}
// --- 报告解析函数 ---
export function parseStructuredReport(text) {
    const report = {
        summary: 'Code review completed',
        total_issues: 0,
        severity_counts: { critical: 0, major: 0, minor: 0, info: 0 },
        issues: [],
        positives: [],
        scope: 'Unknown',
    };
    try {
        // 尝试提取总结
        const summaryMatch = text.match(/##?\s*Summary[:\s]*([\s\S]*?)(?=\n##|\n---|$)/i);
        if (summaryMatch) {
            report.summary = summaryMatch[1].trim();
        }
        // 尝试提取评分
        const scoreMatch = text.match(/(?:Score|评分)[:\s]*(\d+)/i);
        if (scoreMatch) {
            report.score = parseInt(scoreMatch[1], 10);
        }
        // 解析问题列表
        // 支持多种格式：## Critical Issues, ### Security Issues, 等
        const issuePatterns = [
            // 格式 1: ## Critical (2)\n- file.ts:L45 - Title\n  Description\n  Suggestion
            /##?\s*(Critical|Major|Minor|Info)\s*(?:Issues|问题)?[:\s]*(\d+)?\n([\s\S]*?)(?=##|\n---|$)/gi,
            // 格式 2: - **Critical** - file.ts:L45 - Title
            /^[-*]\s*\*\*(Critical|Major|Minor|Info)\*\*\s*[-–—]\s*(\S+)\s*(?::L|:line\s*|L)(\d+)\s*[-–—]\s*(.+)$/gm,
        ];
        // 简化的解析逻辑：按行扫描
        const lines = text.split('\n');
        let currentSeverity = 'info';
        let currentIssue = {};
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 检测严重等级标题
            if (/^#{1,3}\s*(Critical|Major|Minor|Info)/i.test(line)) {
                const match = line.match(/(Critical|Major|Minor|Info)/i);
                if (match) {
                    currentSeverity = match[1].toLowerCase();
                }
            }
            // 检测问题条目（以 - 或 * 开头）
            if (/^[-*]\s+/.test(line) && line.includes(':')) {
                // 尝试解析：- file.ts:L45 - Title
                const issueMatch = line.match(/[-*]\s+(\S+)\s*(?::L|:line\s*|L)(\d+)\s*[-–—]\s*(.+)/);
                if (issueMatch) {
                    if (currentIssue.title) {
                        // 保存上一个问题
                        report.issues.push({
                            ...currentIssue,
                            severity: currentIssue.severity || currentSeverity,
                            category: currentIssue.category || 'correctness',
                        });
                    }
                    currentIssue = {
                        severity: currentSeverity,
                        file: issueMatch[1],
                        line: parseInt(issueMatch[2], 10),
                        title: issueMatch[3],
                        description: '',
                        suggestion: '',
                    };
                }
            }
            // 检测描述和建议
            if (currentIssue.title) {
                if (/^(描述|Description|问题)/i.test(line.trim())) {
                    currentIssue.description = lines.slice(i + 1, i + 3).join('\n').trim();
                }
                if (/^(建议|Suggestion|Fix|修复)/i.test(line.trim())) {
                    currentIssue.suggestion = lines.slice(i + 1, i + 3).join('\n').trim();
                }
            }
            // 检测正面评价
            if (/^#{1,3}\s*(Positives|Strengths|优点|做得好)/i.test(line)) {
                for (let j = i + 1; j < lines.length; j++) {
                    if (/^[-*]\s+/.test(lines[j])) {
                        report.positives.push(lines[j].replace(/^[-*]\s+/, '').trim());
                    }
                    else if (/^#{1,3}/.test(lines[j])) {
                        break;
                    }
                }
            }
        }
        // 保存最后一个问题
        if (currentIssue.title) {
            report.issues.push({
                ...currentIssue,
                severity: currentIssue.severity || currentSeverity,
                category: currentIssue.category || 'correctness',
            });
        }
        // 统计严重等级
        for (const issue of report.issues) {
            report.severity_counts[issue.severity]++;
        }
        report.total_issues = report.issues.length;
        // 如果没有解析出总结，使用默认值
        if (report.summary === 'Code review completed' && text.length > 100) {
            report.summary = `Found ${report.total_issues} issue(s): ${report.severity_counts.critical} critical, ${report.severity_counts.major} major, ${report.severity_counts.minor} minor`;
        }
    }
    catch (error) {
        console.error('Failed to parse code review report:', error);
        // 如果解析失败，返回原始文本作为总结
        report.summary = text.slice(0, 500);
    }
    return report;
}
// --- 工具定义 ---
export const codeReviewTool = {
    name: 'code_review',
    description: 'Perform comprehensive code review on specified scope. Supports reviewing git diff, specific files, entire projects, or pull requests. Returns structured report with issues categorized by severity.',
    parameters: {
        type: 'object',
        properties: {
            scope: {
                type: 'string',
                enum: ['diff', 'file', 'project', 'pr'],
                description: 'Review scope: "diff" (git changes), "file" (specific file), "project" (entire project), "pr" (pull request)',
            },
            file_path: {
                type: 'string',
                description: 'File path to review (required when scope="file")',
            },
            pr_identifier: {
                type: 'string',
                description: 'PR number or URL (required when scope="pr")',
            },
            focus_areas: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['security', 'performance', 'correctness', 'style', 'best_practices'],
                },
                description: 'Areas to focus on. Default: all areas',
            },
            max_issues: {
                type: 'number',
                description: 'Maximum number of issues to report (default: 20)',
            },
        },
        required: ['scope'],
    },
    async execute(params, context) {
        if (!_subAgentExecute) {
            return {
                content: 'Error: Code review tool not initialized. Sub-agent executor is required.',
                isError: true,
            };
        }
        try {
            const scope = params.scope;
            const filePath = params.file_path;
            const prIdentifier = params.pr_identifier;
            const focusAreas = params.focus_areas || ['security', 'performance', 'correctness', 'style', 'best_practices'];
            const maxIssues = params.max_issues || 20;
            // Step 1: 收集审查上下文
            let contextContent = '';
            let scopeDescription = '';
            switch (scope) {
                case 'diff':
                    contextContent = await collectDiffContext(context.workingDirectory);
                    scopeDescription = 'Git changes (staged + unstaged)';
                    break;
                case 'file':
                    if (!filePath) {
                        return {
                            content: 'Error: file_path is required when scope="file"',
                            isError: true,
                        };
                    }
                    contextContent = await collectFileContext(filePath, context.workingDirectory);
                    scopeDescription = `File: ${filePath}`;
                    break;
                case 'project':
                    contextContent = await collectProjectContext(context.workingDirectory);
                    scopeDescription = 'Entire project';
                    break;
                case 'pr':
                    if (!prIdentifier) {
                        return {
                            content: 'Error: pr_identifier is required when scope="pr"',
                            isError: true,
                        };
                    }
                    contextContent = await collectPRContext(prIdentifier, context.workingDirectory);
                    scopeDescription = `Pull Request: ${prIdentifier}`;
                    break;
                default:
                    return {
                        content: `Error: Unknown scope "${scope}". Supported scopes: diff, file, project, pr`,
                        isError: true,
                    };
            }
            // Step 2: 构造审查任务描述
            const focusDescription = focusAreas.length < 5
                ? `Focus areas: ${focusAreas.join(', ')}`
                : 'Comprehensive review covering all aspects';
            const taskDescription = `You are a code review expert. Please review the following code and provide a structured report.

${focusDescription}
Maximum issues to report: ${maxIssues}

## Code to Review

${contextContent}

## Required Output Format

Please format your review as follows:

# Code Review Report

## Summary
[One-paragraph summary of overall code quality]

## Score
[Overall score 0-100]

## Critical Issues (security vulnerabilities, data loss risks)
- file_path:Lline_number - Issue title
  Description: [What's the problem]
  Suggestion: [How to fix it]

## Major Issues (bugs, performance bottlenecks)
- file_path:Lline_number - Issue title
  Description: [What's the problem]
  Suggestion: [How to fix it]

## Minor Issues (code smells, maintainability concerns)
- file_path:Lline_number - Issue title
  Description: [What's the problem]
  Suggestion: [How to fix it]

## Info (style suggestions, best practices)
- file_path:Lline_number - Issue title
  Description: [What's the problem]
  Suggestion: [How to fix it]

## Positives
- [What's done well]
- [Good practices observed]

Be specific, actionable, and constructive. Include exact file paths and line numbers where possible.`;
            // Step 3: 调用 sub-agent 执行审查
            context.onProgress?.('Starting code review...');
            const reviewResult = await _subAgentExecute('code-reviewer', taskDescription, context.signal);
            // Step 4: 解析结果为结构化报告
            context.onProgress?.('Parsing review results...');
            const report = parseStructuredReport(reviewResult);
            report.scope = scopeDescription;
            // Step 5: 返回结构化报告
            const summary = `🔍 Code Review Complete\n\n` +
                `Scope: ${report.scope}\n` +
                `Summary: ${report.summary}\n\n` +
                `Issues Found: ${report.total_issues}\n` +
                `  🔴 Critical: ${report.severity_counts.critical}\n` +
                `  🟡 Major: ${report.severity_counts.major}\n` +
                `  🔵 Minor: ${report.severity_counts.minor}\n` +
                `  ℹ️ Info: ${report.severity_counts.info}\n\n` +
                (report.positives.length > 0 ? `Positives: ${report.positives.length}\n` : '') +
                `\n[CODE_REVIEW_REPORT]\n${JSON.stringify(report, null, 2)}`;
            return { content: summary };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: `Code review failed: ${msg}`,
                isError: true,
            };
        }
    },
};
//# sourceMappingURL=code-review.js.map