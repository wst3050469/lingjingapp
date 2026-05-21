// PR creation helpers via gh CLI
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixGbkString } from '../utils/encoding.js';
const execFileAsync = promisify(execFile);
async function gh(args, cwd) {
    try {
        const { stdout } = await execFileAsync('gh', args, { cwd });
        return stdout.trim();
    }
    catch (error) {
        const msg = error instanceof Error ? fixGbkString(error.stderr || error.message) : String(error);
        throw new Error(`gh ${args[0]} failed: ${msg}`);
    }
}
export async function isGhAvailable() {
    try {
        await execFileAsync('gh', ['--version']);
        return true;
    }
    catch {
        return false;
    }
}
export async function createPR(cwd, options) {
    const args = ['pr', 'create', '--title', options.title, '--body', options.body];
    if (options.base) {
        args.push('--base', options.base);
    }
    if (options.draft) {
        args.push('--draft');
    }
    return gh(args, cwd);
}
export async function getPRStatus(cwd) {
    return gh(['pr', 'status'], cwd);
}
export async function getPRView(cwd, prNumber) {
    const args = ['pr', 'view'];
    if (prNumber)
        args.push(prNumber);
    args.push('--json', 'title,state,url,body,author,additions,deletions');
    return gh(args, cwd);
}
//# sourceMappingURL=pr.js.map