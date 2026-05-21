// Git operations - typed wrappers around git commands
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixGbkString } from '../utils/encoding.js';
const execFileAsync = promisify(execFile);
async function git(args, cwd) {
    try {
        const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
        return stdout.trim();
    }
    catch (error) {
        const msg = error instanceof Error ? fixGbkString(error.stderr || error.message) : String(error);
        throw new Error(`git ${args[0]} failed: ${msg}`);
    }
}
export async function isGitRepo(cwd) {
    try {
        await git(['rev-parse', '--is-inside-work-tree'], cwd);
        return true;
    }
    catch {
        return false;
    }
}
export async function gitCurrentBranch(cwd) {
    return git(['branch', '--show-current'], cwd);
}
export async function gitStatus(cwd) {
    const output = await git(['status', '--porcelain=v2', '--branch'], cwd);
    const lines = output.split('\n');
    const result = {
        staged: [],
        unstaged: [],
        untracked: [],
        branch: '',
        ahead: 0,
        behind: 0,
    };
    for (const line of lines) {
        if (line.startsWith('# branch.head ')) {
            result.branch = line.slice('# branch.head '.length);
        }
        else if (line.startsWith('# branch.ab ')) {
            const match = line.match(/\+(\d+) -(\d+)/);
            if (match) {
                result.ahead = parseInt(match[1], 10);
                result.behind = parseInt(match[2], 10);
            }
        }
        else if (line.startsWith('1 ') || line.startsWith('2 ')) {
            // Changed entries
            const parts = line.split('\t');
            const statusInfo = line.split(' ');
            const xy = statusInfo[1]; // XY status codes
            const filePath = parts[parts.length - 1] ?? statusInfo[statusInfo.length - 1];
            if (xy && xy[0] !== '.') {
                result.staged.push({ status: parseStatusChar(xy[0]), file: filePath });
            }
            if (xy && xy[1] !== '.') {
                result.unstaged.push({ status: parseStatusChar(xy[1]), file: filePath });
            }
        }
        else if (line.startsWith('? ')) {
            result.untracked.push(line.slice(2));
        }
    }
    return result;
}
function parseStatusChar(char) {
    switch (char) {
        case 'A': return 'added';
        case 'M': return 'modified';
        case 'D': return 'deleted';
        case 'R': return 'renamed';
        case 'C': return 'copied';
        default: return 'modified';
    }
}
export async function gitDiff(cwd, staged = false) {
    const args = staged ? ['diff', '--staged'] : ['diff'];
    return git(args, cwd);
}
export async function gitDiffBranch(cwd, base) {
    return git(['diff', `${base}...HEAD`], cwd);
}
export async function gitLog(cwd, count = 10) {
    const format = '%H%n%h%n%an%n%ai%n%s';
    const output = await git(['log', `-${count}`, `--format=${format}`], cwd);
    if (!output)
        return [];
    const lines = output.split('\n');
    const commits = [];
    for (let i = 0; i + 4 < lines.length; i += 5) {
        commits.push({
            hash: lines[i],
            shortHash: lines[i + 1],
            author: lines[i + 2],
            date: lines[i + 3],
            message: lines[i + 4],
        });
    }
    return commits;
}
export async function gitAdd(cwd, files) {
    await git(['add', ...files], cwd);
}
export async function gitCommit(cwd, message) {
    return git(['commit', '-m', message], cwd);
}
export async function gitStash(cwd) {
    return git(['stash'], cwd);
}
export async function gitStashPop(cwd) {
    return git(['stash', 'pop'], cwd);
}
export async function gitRevParseHead(cwd) {
    return git(['rev-parse', 'HEAD'], cwd);
}
export async function gitDiffNameOnly(cwd, fromCommit, toCommit = 'HEAD') {
    const output = await git(['diff', '--name-only', fromCommit, toCommit], cwd);
    if (!output)
        return [];
    return output.split('\n').filter(Boolean);
}
//# sourceMappingURL=operations.js.map