import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
async function executeLintFix(cwd, options = {}) {
    const result = {
        filesChecked: 0,
        filesFixed: 0,
        errors: [],
        warnings: [],
        fixed: [],
    };
    const { linter = 'auto', fix = true, files = ['.'], config } = options;
    const detectLinter = () => {
        if (linter !== 'auto')
            return linter;
        if (existsSync(join(cwd, 'biome.json')) || existsSync(join(cwd, '.biome.json'))) {
            return 'biome';
        }
        if (existsSync(join(cwd, '.prettierrc')) || existsSync(join(cwd, '.prettierrc.json')) || existsSync(join(cwd, 'prettier.config.js'))) {
            return 'prettier';
        }
        if (existsSync(join(cwd, '.eslintrc')) || existsSync(join(cwd, '.eslintrc.json')) || existsSync(join(cwd, 'eslint.config.js'))) {
            return 'eslint';
        }
        return 'eslint';
    };
    const detectedLinter = detectLinter();
    const filePatterns = files.join(' ');
    try {
        switch (detectedLinter) {
            case 'eslint': {
                const eslintCmd = fix
                    ? `npx eslint ${filePatterns} --fix ${config ? `--config ${config}` : ''} --format json`
                    : `npx eslint ${filePatterns} ${config ? `--config ${config}` : ''} --format json`;
                try {
                    const output = execSync(eslintCmd, {
                        cwd,
                        encoding: 'utf-8',
                        timeout: 60000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    if (output && output.trim()) {
                        const results = JSON.parse(output);
                        for (const fileResult of results) {
                            result.filesChecked++;
                            if (fileResult.errorCount > 0 || fileResult.warningCount > 0) {
                                for (const msg of fileResult.messages) {
                                    if (msg.severity === 2) {
                                        result.errors.push(`${fileResult.filePath}:${msg.line}:${msg.column} ${msg.ruleId}: ${msg.message}`);
                                    }
                                    else {
                                        result.warnings.push(`${fileResult.filePath}:${msg.line}:${msg.column} ${msg.ruleId}: ${msg.message}`);
                                    }
                                }
                            }
                            if (fix && fileResult.output) {
                                result.filesFixed++;
                                result.fixed.push(fileResult.filePath);
                            }
                        }
                    }
                }
                catch (err) {
                    const stderr = err.stderr?.toString() || '';
                    const stdout = err.stdout?.toString() || '';
                    if (stdout && stdout.trim()) {
                        try {
                            const results = JSON.parse(stdout);
                            for (const fileResult of results) {
                                result.filesChecked++;
                                for (const msg of fileResult.messages) {
                                    if (msg.severity === 2) {
                                        result.errors.push(`${fileResult.filePath}:${msg.line}:${msg.column} ${msg.ruleId}: ${msg.message}`);
                                    }
                                    else {
                                        result.warnings.push(`${fileResult.filePath}:${msg.line}:${msg.column} ${msg.ruleId}: ${msg.message}`);
                                    }
                                }
                                if (fix && fileResult.output) {
                                    result.filesFixed++;
                                    result.fixed.push(fileResult.filePath);
                                }
                            }
                        }
                        catch {
                            result.errors.push(`ESLint execution failed: ${stderr || err.message}`);
                        }
                    }
                    else {
                        result.errors.push(`ESLint not found or failed to execute: ${stderr || err.message}`);
                    }
                }
                break;
            }
            case 'prettier': {
                const prettierCmd = fix
                    ? `npx prettier ${filePatterns} --write ${config ? `--config ${config}` : ''}`
                    : `npx prettier ${filePatterns} --check ${config ? `--config ${config}` : ''}`;
                try {
                    const output = execSync(prettierCmd, {
                        cwd,
                        encoding: 'utf-8',
                        timeout: 60000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    const lines = output.split('\n').filter(Boolean);
                    result.filesChecked = lines.length;
                    if (fix) {
                        result.filesFixed = lines.length;
                        result.fixed = lines;
                    }
                }
                catch (err) {
                    const stdout = err.stdout?.toString() || '';
                    const stderr = err.stderr?.toString() || '';
                    if (!fix && stdout.includes('does not match')) {
                        const unmatchedFiles = stdout.split('\n').filter((line) => line.includes('does not match'));
                        result.warnings.push(...unmatchedFiles);
                        result.filesChecked = unmatchedFiles.length;
                    }
                    else if (fix) {
                        const lines = stdout.split('\n').filter((line) => line.trim() && !line.includes('ms'));
                        result.filesChecked = lines.length;
                        result.filesFixed = lines.length;
                        result.fixed = lines;
                    }
                    else {
                        result.errors.push(`Prettier execution failed: ${stderr || err.message}`);
                    }
                }
                break;
            }
            case 'biome': {
                const biomeCmd = fix
                    ? `npx biome format ${filePatterns} --write ${config ? `--config-path ${config}` : ''}`
                    : `npx biome check ${filePatterns} ${config ? `--config-path ${config}` : ''}`;
                try {
                    const output = execSync(biomeCmd, {
                        cwd,
                        encoding: 'utf-8',
                        timeout: 60000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    if (output.includes('formatted')) {
                        const match = output.match(/formatted\s+(\d+)\s+files?/i);
                        if (match) {
                            result.filesFixed = parseInt(match[1], 10);
                        }
                    }
                    const checkedMatch = output.match(/checked\s+(\d+)\s+files?/i);
                    if (checkedMatch) {
                        result.filesChecked = parseInt(checkedMatch[1], 10);
                    }
                }
                catch (err) {
                    const stdout = err.stdout?.toString() || '';
                    const stderr = err.stderr?.toString() || '';
                    if (stdout) {
                        const lines = stdout.split('\n');
                        for (const line of lines) {
                            if (line.includes('error') || line.includes('Error')) {
                                result.errors.push(line);
                            }
                            else if (line.includes('warn') || line.includes('Warn')) {
                                result.warnings.push(line);
                            }
                        }
                    }
                    else {
                        result.errors.push(`Biome execution failed: ${stderr || err.message}`);
                    }
                }
                break;
            }
        }
    }
    catch (err) {
        result.errors.push(`Unexpected error: ${err.message}`);
    }
    return result;
}
export const lintFixTool = {
    name: 'lint_fix',
    description: 'Run linter (ESLint/Prettier/Biome) and automatically fix code style issues. Detects project linter automatically or uses specified one.',
    parameters: {
        type: 'object',
        properties: {
            linter: {
                type: 'string',
                enum: ['eslint', 'prettier', 'biome', 'auto'],
                description: 'Linter to use. Auto-detects based on config files if not specified.',
            },
            fix: {
                type: 'boolean',
                description: 'Whether to automatically fix issues. Default: true',
            },
            files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files or directories to lint. Default: ["."] (current directory)',
            },
            config: {
                type: 'string',
                description: 'Path to linter config file',
            },
        },
    },
    async execute(args, context) {
        const cwd = context.workingDirectory || process.cwd();
        try {
            const result = await executeLintFix(cwd, {
                linter: args.linter,
                fix: args.fix !== false,
                files: args.files,
                config: args.config,
            });
            let output = `## Lint Fix Results\n\n`;
            output += `- **Linter Used**: ${args.linter || 'auto-detected'}\n`;
            output += `- **Files Checked**: ${result.filesChecked}\n`;
            output += `- **Files Fixed**: ${result.filesFixed}\n`;
            output += `- **Errors**: ${result.errors.length}\n`;
            output += `- **Warnings**: ${result.warnings.length}\n\n`;
            if (result.fixed.length > 0) {
                output += `### Fixed Files\n`;
                for (const file of result.fixed) {
                    output += `- ${file}\n`;
                }
                output += '\n';
            }
            if (result.errors.length > 0) {
                output += `### Errors\n`;
                for (const err of result.errors.slice(0, 20)) {
                    output += `- ${err}\n`;
                }
                if (result.errors.length > 20) {
                    output += `... and ${result.errors.length - 20} more errors\n`;
                }
                output += '\n';
            }
            if (result.warnings.length > 0) {
                output += `### Warnings\n`;
                for (const warn of result.warnings.slice(0, 20)) {
                    output += `- ${warn}\n`;
                }
                if (result.warnings.length > 20) {
                    output += `... and ${result.warnings.length - 20} more warnings\n`;
                }
            }
            return {
                content: output,
                isError: result.errors.length > 0,
            };
        }
        catch (err) {
            return {
                content: `Lint fix failed: ${err.message}`,
                isError: true,
            };
        }
    },
};
//# sourceMappingURL=lint-fix.js.map