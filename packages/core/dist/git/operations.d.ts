export interface GitStatus {
    staged: FileChange[];
    unstaged: FileChange[];
    untracked: string[];
    branch: string;
    ahead: number;
    behind: number;
}
export interface FileChange {
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    file: string;
}
export interface GitCommit {
    hash: string;
    shortHash: string;
    author: string;
    date: string;
    message: string;
}
export declare function isGitRepo(cwd: string): Promise<boolean>;
export declare function gitCurrentBranch(cwd: string): Promise<string>;
export declare function gitStatus(cwd: string): Promise<GitStatus>;
export declare function gitDiff(cwd: string, staged?: boolean): Promise<string>;
export declare function gitDiffBranch(cwd: string, base: string): Promise<string>;
export declare function gitLog(cwd: string, count?: number): Promise<GitCommit[]>;
export declare function gitAdd(cwd: string, files: string[]): Promise<void>;
export declare function gitCommit(cwd: string, message: string): Promise<string>;
export declare function gitStash(cwd: string): Promise<string>;
export declare function gitStashPop(cwd: string): Promise<string>;
export declare function gitRevParseHead(cwd: string): Promise<string>;
export declare function gitDiffNameOnly(cwd: string, fromCommit: string, toCommit?: string): Promise<string[]>;
//# sourceMappingURL=operations.d.ts.map