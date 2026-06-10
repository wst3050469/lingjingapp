const DEFAULT_SAFE_COMMANDS = new Set([
    'ls', 'cat', 'head', 'tail', 'find', 'grep', 'rg', 'fd', 'git', 'node', 'npm',
    'npx', 'yarn', 'pnpm', 'python', 'python3', 'pip', 'echo', 'pwd', 'which',
    'where', 'env', 'printenv', 'date', 'whoami', 'id', 'uname', 'df', 'du',
    'free', 'top', 'ps', 'wc', 'sort', 'uniq', 'diff', 'patch', 'curl', 'wget',
    'mkdir', 'touch', 'cp', 'mv', 'chmod', 'chown', 'stat', 'file', 'type',
    'tsc', 'eslint', 'prettier', 'vitest', 'jest', 'pytest', 'cargo', 'go',
    'rustc', 'gcc', 'make', 'cmake', 'dotnet', 'java', 'javac', 'mvn', 'gradle',
]);
const DANGEROUS_PATTERNS = [
    /\brm\s+-(?:rf|fr|Rf|fR|rF|Fr)\b/,
    /\bsudo\b/,
    /\bsu\b/,
    /\bchmod\s+[0-7]*77[0-7]?\b/,
    /\bcurl\b.*\|\s*(?:sh|bash|zsh|fish)/,
    /\bwget\b.*\|\s*(?:sh|bash|zsh|fish)/,
    /\bmkfs\b/,
    /\bdd\b/,
    /\bformat\b/,
    /:\(\)\{.*\}\s*;/, // fork bomb pattern
    /\bshutdown\b/,
    /\breboot\b/,
    /\bkill\s+-9\b/,
    /\biptables\b/,
    />\s*\/dev\/(?:sda|hda|nvme)/,
];
export class BashWhitelist {
    safeCommands;
    customAllowed = new Set();
    customBlocked = new Set();
    constructor(additionalSafe) {
        this.safeCommands = new Set(DEFAULT_SAFE_COMMANDS);
        if (additionalSafe) {
            for (const cmd of additionalSafe) {
                this.safeCommands.add(cmd);
            }
        }
    }
    isAllowed(command) {
        const baseCommand = this.extractBaseCommand(command);
        if (this.customBlocked.has(baseCommand))
            return false;
        if (this.customAllowed.has(baseCommand))
            return true;
        return this.safeCommands.has(baseCommand);
    }
    isDangerous(command) {
        return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
    }
    addAllowed(command) {
        this.customAllowed.add(command);
        this.customBlocked.delete(command);
    }
    addBlocked(command) {
        this.customBlocked.add(command);
        this.customAllowed.delete(command);
    }
    extractBaseCommand(command) {
        const trimmed = command.trim();
        const firstPart = trimmed.split(/\s+/)[0] || '';
        const lastSlash = firstPart.lastIndexOf('/');
        return lastSlash >= 0 ? firstPart.substring(lastSlash + 1) : firstPart;
    }
}
//# sourceMappingURL=bash-whitelist.js.map