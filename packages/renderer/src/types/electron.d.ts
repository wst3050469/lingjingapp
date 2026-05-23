/* eslint-disable @typescript-eslint/no-explicit-any */
// Type declarations for window.electronAPI exposed by preload.ts

declare interface ElectronAPI {
  agent: {
    run: (message: string, options?: {
      mode?: string;
      conversationId?: string;
      contexts?: { id: string; type: string; label: string; path: string; content?: string }[];
      images?: { data: string; mediaType: string }[];
      conversationMessages?: any[];
    }) => Promise<void>;
    abort: () => Promise<void>;
    resetConversation: () => Promise<void>;
    onEvent: (callback: (event: any) => void) => () => void;
    onAskUser: (callback: (data: any) => void) => () => void;
    replyAskUser: (requestId: string, answer: string) => Promise<any>;
    confirmReply: (requestId: string, approved: boolean, feedback?: string) => Promise<any>;
    onConfirmRequest: (callback: (data: any) => void) => () => void;
    sendIntervention: (text: string) => Promise<void>;
    toolCalls?: any[];
  };
  fs: {
    readDir: (path: string) => Promise<any>;
    readFile: (path: string) => Promise<any>;
    writeFile: (path: string, content: string) => Promise<any>;
    onChanged: (callback: (event: any) => void) => () => void;
    selectFolder: () => Promise<string | null>;
    selectFile: () => Promise<string | null>;
    saveAs: (defaultName?: string) => Promise<string | null>;
  };
  terminal: {
    create: (cwd?: string) => Promise<{ terminalId: string }>;
    input: (terminalId: string, data: string) => Promise<void>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
    destroy: (terminalId: string) => Promise<void>;
    onData: (callback: (data: any) => void) => () => void;
  };
  config: {
    get: () => Promise<any>;
    set: (key: string, value: unknown) => Promise<any>;
    getWorkspace: () => Promise<string>;
    setWorkspace: (path: string) => Promise<any>;
    reset: () => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    platform: () => Promise<string>;
    onLog: (callback: (data: any) => void) => () => void;
    onDbStatus: (callback: (data: any) => void) => () => void;
    onWindowBeforeClose: (callback: () => void) => () => void;
    confirmWindowClose: () => void;
  };
  update: {
    check: () => Promise<any>;
    download: () => Promise<any>;
    install: () => Promise<any>;
    setAutoDownload: (enabled: boolean) => Promise<any>;
    onChecking: (callback: () => void) => () => void;
    onAvailable: (callback: (info: any) => void) => () => void;
    onNotAvailable: (callback: () => void) => () => void;
    onProgress: (callback: (info: any) => void) => () => void;
    onDownloaded: (callback: (info: any) => void) => () => void;
    onError: (callback: (error: any) => void) => () => void;
  };
  window: {
    newWindow: () => Promise<void>;
    close: () => Promise<void>;
    zoomIn: () => Promise<void>;
    zoomOut: () => Promise<void>;
    zoomReset: () => Promise<void>;
    openDevTools: () => Promise<void>;
  };
  auth: {
    register: (username: string, password: string, email?: string) => Promise<any>;
    login: (username: string, password: string) => Promise<any>;
    verify: (token: string) => Promise<any>;
  };
  conversation: {
    save: (userId: number, conversationId: string, title: string, messages: any[]) => Promise<any>;
    saveSync: (userId: number, conversationId: string, title: string, messages: any[]) => any;
    list: (userId: number) => Promise<any[]>;
    load: (conversationId: string) => Promise<any>;
    delete: (conversationId: string) => Promise<any>;
    rename: (conversationId: string, newTitle: string) => Promise<any>;
  };
  mcp: {
    connect: (name: string, config: any) => Promise<any>;
    disconnect: (name: string) => Promise<any>;
    listServers: () => Promise<any[]>;
    listSaved: () => Promise<any[]>;
    listStates: () => Promise<any[]>;
    callTool: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<any>;
    marketplaceList: () => Promise<any[]>;
    marketplaceInstall: (id: string, env?: Record<string, string>) => Promise<any>;
    onChromiumInstallProgress: (callback: (data: any) => void) => () => void;
  };
  ollama: {
    listModels: () => Promise<{ models: Array<{ name: string }> }>;
  };
  git: {
    init: () => Promise<any>;
    status: () => Promise<any>;
    log: (count?: number) => Promise<any[]>;
    addAll: () => Promise<any>;
    add: (paths: string[]) => Promise<any>;
    commit: (message: string) => Promise<any>;
  };
  tools: {
    list: () => Promise<any[]>;
  };

  trigger: {
    create: (type: string, config: any) => Promise<any>;
    update: (triggerId: string, config: any) => Promise<any>;
    delete: (triggerId: string) => Promise<any>;
    enable: (triggerId: string) => Promise<any>;
    disable: (triggerId: string) => Promise<any>;
    getStatus: (triggerId: string) => Promise<any>;
    list: () => Promise<any[]>;
    getConfig: (triggerId: string) => Promise<any>;
    onFired: (callback: (data: any) => void) => () => void;
    onStatusChange: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };
  githubSkill: {
    list: () => Promise<any[]>;
    uninstall: (id: string) => Promise<any>;
  };

  github: {
    search: (query: string, limit?: number) => Promise<any[]>;
    generateAuthUrl: (scopes?: string[]) => Promise<string>;
    handleCallback: (code: string, state: string) => Promise<any>;
    getUser: () => Promise<any>;
    getRepositories: () => Promise<any[]>;
    createRepository: (name: string, options?: any) => Promise<any>;
    getFile: (owner: string, repo: string, path: string, ref?: string) => Promise<any>;
    putFile: (owner: string, repo: string, path: string, content: string, message: string, sha?: string) => Promise<any>;
    listAccounts: () => Promise<any[]>;
    switchAccount: (accountId: string) => Promise<any>;
    removeAccount: (accountId: string) => Promise<any>;
    getSavedToken: (accountId: string) => Promise<any>;
    getRepos: () => Promise<any[]>;
    getBranches: (repo: string) => Promise<any[]>;
    createPR: (repo: string, title: string, body: string, head: string, base: string) => Promise<any>;
    listPRs: (repo: string) => Promise<any[]>;
    listIssues: (repo: string) => Promise<any[]>;
  };
  cloudManagement: {
    user: {
      getInfo: () => Promise<any>;
      update: (params: any) => Promise<any>;
      changePassword: (params: any) => Promise<any>;
      getSecuritySettings: () => Promise<any>;
      updateSecuritySettings: (settings: any) => Promise<any>;
      enableTwoFactor: (params: any) => Promise<any>;
      disableTwoFactor: (code: string) => Promise<any>;
      verifyTwoFactor: (code: string) => Promise<any>;
      getLoginHistory: (limit?: number, offset?: number) => Promise<any[]>;
      logoutAllDevices: () => Promise<any>;
      deleteAccount: (password: string) => Promise<any>;
      updateAvatar: (avatarData: string) => Promise<any>;
    };
    device: {
      getAll: () => Promise<any[]>;
      get: (deviceId: string) => Promise<any>;
      register: (params: any) => Promise<any>;
      updateName: (deviceId: string, name: string) => Promise<any>;
      revoke: (deviceId: string) => Promise<any>;
      delete: (deviceId: string) => Promise<any>;
      generateAuthCode: () => Promise<string>;
      authorize: (code: string) => Promise<any>;
      getCurrent: () => Promise<any>;
      getOnline: () => Promise<any>;
    };
    apiKey: {
      getAll: (params?: any) => Promise<any[]>;
      get: (keyId: string) => Promise<any>;
      create: (params: any) => Promise<any>;
      update: (keyId: string, params: any) => Promise<any>;
      delete: (keyId: string) => Promise<any>;
      regenerate: (keyId: string) => Promise<any>;
      toggleStatus: (keyId: string) => Promise<any>;
      getStats: () => Promise<any>;
      getUsageHistory: (keyId: string, params?: any) => Promise<any[]>;
      test: (keyId: string) => Promise<any>;
      getPermissions: () => Promise<any>;
    };
    subscription: {
      get: () => Promise<any>;
      getPlans: () => Promise<any[]>;
      getPlan: (planId: string) => Promise<any>;
      subscribe: (params: any) => Promise<any>;
      upgrade: (planId: string) => Promise<any>;
      downgrade: (planId: string) => Promise<any>;
      cancel: (reason?: string) => Promise<any>;
      renew: () => Promise<any>;
      enableAutoRenew: () => Promise<any>;
      disableAutoRenew: () => Promise<any>;
      getUsage: () => Promise<any>;
      comparePlans: () => Promise<any>;
      getPayments: () => Promise<any[]>;
      submitOfflinePayment: (params: any) => Promise<any>;
      getInvoices: () => Promise<any[]>;
      createInvoice: (params: any) => Promise<any>;
    };
    sync: {
      getStatus: () => Promise<any>;
      now: (params?: any) => Promise<any>;
      pause: () => Promise<any>;
      resume: () => Promise<any>;
      getHistory: (limit?: number, offset?: number) => Promise<any[]>;
      getConflicts: () => Promise<any[]>;
      resolveConflict: (params: any) => Promise<any>;
      resolveAllConflicts: (resolution: string) => Promise<any>;
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<any>;
      getPendingChanges: () => Promise<any>;
    };
    storage: {
      getStats: () => Promise<any>;
      getFiles: (params?: any) => Promise<any[]>;
      getFile: (fileId: string) => Promise<any>;
      deleteFile: (fileId: string) => Promise<any>;
      deleteFiles: (fileIds: string[]) => Promise<any>;
      downloadFile: (fileId: string) => Promise<any>;
      getCleanupSuggestions: () => Promise<any>;
      performCleanup: (params: any) => Promise<any>;
      exportData: (dataTypes: string[]) => Promise<any>;
      importData: (file: any) => Promise<any>;
      getCategoryStats: () => Promise<any>;
    };
  };
  cloudSync: {
    init: () => Promise<any>;
    push: (dataType: string, operation: string, payload: any) => Promise<any>;
    pull: (dataType: string, dataId: string) => Promise<any>;
    syncNow: () => Promise<any>;
    getProgress: () => Promise<any>;
    subscribe: (channel: string, callback: (data: any) => void) => () => void;
    onStatus: (callback: (data: any) => void) => () => void;
    onSyncEvent: (callback: (data: any) => void) => () => void;
  };
  batch: {
    list: () => Promise<any[]>;
    getStatus: () => Promise<any>;
    start: (opts: any) => Promise<any>;
    stop: () => Promise<any>;
    getResults: () => Promise<any[]>;
    getResult: (id: string) => Promise<any>;
    cancel: (id: string) => Promise<any>;
    pause: (id: string) => Promise<any>;
    resume: (id: string) => Promise<any>;
    onProgress: (callback: (data: any) => void) => () => void;
    onComplete: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };
  connector: {
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    connect: (id: string, config?: any) => Promise<any>;
    disconnect: (id: string) => Promise<any>;
    test: (id: string) => Promise<any>;
    configure: (id: string, config: any) => Promise<any>;
    register: (data: any) => Promise<any>;
    unregister: (id: string) => Promise<any>;
    onStatus: (callback: (data: any) => void) => () => void;
  };
  workflow: {
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
    run: (id: string, inputs?: any) => Promise<any>;
    stop: (id: string) => Promise<any>;
    getStatus: (id: string) => Promise<any>;
    getLogs: (id: string) => Promise<any[]>;
    onEvent: (callback: (data: any) => void) => () => void;
    onProgress: (callback: (data: any) => void) => () => void;
    onLog: (callback: (data: any) => void) => () => void;
  };
  memory: {
    list: (opts?: { scope?: string; projectPath?: string }) => Promise<any[]>;
    search: (query: string, scope?: string, projectPath?: string) => Promise<any[]>;
    add: (mem: { scope: string; projectPath?: string; category: string; title: string; content: string; source: string }) => Promise<any>;
    delete: (id: string) => Promise<any>;
    clear: (opts?: { scope?: string; projectPath?: string }) => Promise<any>;
  };
  skills: {
    list: () => Promise<any[]>;
    listFull: () => Promise<any[]>;
    catalog: () => Promise<any>;
    listAgents: () => Promise<any[]>;
    listAgentsFull: () => Promise<any[]>;
    create: (opts: { name: string; description: string; level: string; content?: string }) => Promise<any>;
    createAgent: (opts: { name: string; description: string; level: string; systemPrompt?: string }) => Promise<any>;
    saveAgent: (opts: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    read: (path: string) => Promise<any>;
    readAgent: (path: string) => Promise<any>;
  };
  integrations: {
    githubValidate: (token: string) => Promise<any>;
    githubGetSavedToken: () => Promise<any>;
    githubConnect: (token: string) => Promise<any>;
    githubDisconnect: () => Promise<any>;
    supabaseValidate: (projectUrl: string, anonKey: string) => Promise<any>;
    supabaseConnect: (projectUrl: string, anonKey: string) => Promise<any>;
    supabaseDisconnect: () => Promise<any>;
  };
  network: {
    diagnose: () => Promise<any>;
  };
  diagnostics: {
    get: (opts: { filePath?: string; severity?: string }) => Promise<any>;
    checkServers: () => Promise<any>;
    onUpdate: (callback: (data: any) => void) => () => void;
    offUpdate: (callback: (data: any) => void) => void;
  };
  diffReview: {
    revert: (filePath: string, content: string) => Promise<any>;
    delete: (filePath: string) => Promise<any>;
  };
  inlineChat: {
    generate: (params: any) => Promise<any>;
    abort: () => Promise<any>;
  };
  completion: {
    inline: (params: any) => Promise<any>;
    abort: () => Promise<any>;
    accept: () => void;
    acceptWord: () => void;
    reject: () => void;
    crossFile: (params: any) => Promise<any>;
  };
  compact: {
    summarize: (messages: Array<{ role: string; content: string }>, language?: string) => Promise<{ error?: string; summary?: string; estimatedTokens?: number }>;
  };
  prompt: {
    polish: (text: string) => Promise<{ polished: string; error: string | null }>;
  };
  quest: {
    createTask: (params: { scenario: string; runMode: string; autoMode: string; title?: string }) => Promise<any>;
    listTasks: () => Promise<any[]>;
    loadTask: (taskId: string) => Promise<any>;
    deleteTask: (taskId: string) => Promise<any>;
    renameTask: (taskId: string, title: string) => Promise<any>;
    run: (params: any) => Promise<any>;
    abort: (taskId: string) => Promise<any>;
    pause: (taskId: string) => Promise<any>;
    resume: (taskId: string, message?: string, runId?: string) => Promise<any>;
    updateSpec: (taskId: string, content: string) => Promise<any>;
    confirmReply: (requestId: string, approved: boolean, feedback?: string) => Promise<any>;
    replyAskUser: (requestId: string, answer: string) => Promise<any>;
    sendIntervention: (taskId: string, text: string) => Promise<any>;
    saveMessages: (taskId: string) => Promise<any>;
    stopOnSwitch: (taskId: string, runId?: string) => Promise<any>;
    cleanup: (taskId: string) => Promise<any>;
    onEvent: (callback: (event: any) => void) => () => void;
    onAskUser: (callback: (data: any) => void) => () => void;
    onConfirmRequest: (callback: (data: any) => void) => () => void;
    onLog: (callback: (data: any) => void) => () => void;
  };
  wiki: {
    status: () => Promise<any>;
    generate: () => Promise<any>;
    detectChanges: () => Promise<any>;
    update: (params?: { modules?: string[] }) => Promise<any>;
    checkSync: () => Promise<any>;
    loadToc: () => Promise<any>;
    loadContent: (modulePath: string) => Promise<any>;
    abort: () => Promise<any>;
    onEvent: (callback: (event: any) => void) => () => void;
  };
  browser: {
    initialize: () => Promise<any>;
    execute: (operation: string, params: Record<string, unknown>) => Promise<any>;
    shutdown: () => Promise<any>;
    getState: () => Promise<any>;
    onScreenshot: (callback: (data: any) => void) => () => void;
    onStatus: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };
  plan: {
    update: (planId: string, updates: Record<string, unknown>) => Promise<any>;
    approve: (planId: string) => Promise<any>;
    pause: (planId: string) => Promise<any>;
    resume: (planId: string) => Promise<any>;
    cancel: (planId: string) => Promise<any>;
    export: (planId: string) => Promise<any>;
    import: (planData: Record<string, unknown>) => Promise<any>;
    delete: (planId: string, workingDirectory: string) => Promise<any>;
    load: (planId: string, workingDirectory: string) => Promise<any>;
    templates: () => Promise<{ templates: any[] }>;
  };
  ssh: {
    listConnections: () => Promise<any[]>;
    saveConnection: (form: any) => Promise<any>;
    deleteConnection: (id: string) => Promise<any>;
    testConnection: (form: any) => Promise<any>;
    connect: (connectionId: string) => Promise<any>;
    disconnect: (sshTerminalId: string) => Promise<any>;
    terminalInput: (sshTerminalId: string, data: string) => Promise<any>;
    terminalResize: (sshTerminalId: string, cols: number, rows: number) => Promise<any>;
    onTerminalData: (callback: (data: any) => void) => () => void;
    onTerminalClosed: (callback: (data: any) => void) => () => void;
    readDir: (sshTerminalId: string, path: string) => Promise<any>;
    readFile: (sshTerminalId: string, path: string) => Promise<any>;
    writeFile: (sshTerminalId: string, path: string, content: string) => Promise<any>;
    stat: (sshTerminalId: string, path: string) => Promise<any>;
    mkdir: (sshTerminalId: string, path: string) => Promise<any>;
    delete: (sshTerminalId: string, path: string) => Promise<any>;
    rename: (sshTerminalId: string, oldPath: string, newPath: string) => Promise<any>;
    setWorkspace: (sshTerminalId: string, path: string) => Promise<any>;
    getWorkspace: (sshTerminalId: string) => Promise<string>;
    exec: (sshTerminalId: string, command: string, cwd?: string) => Promise<any>;
  };
  context: {
    searchFiles: (query: string, type: 'file' | 'folder') => Promise<any[]>;
    listRules: () => Promise<any[]>;
    createRule: (name: string, content: string) => Promise<any>;
    parseDocument: (filePath: string) => Promise<any>;
    gitChangedFiles: () => Promise<any[]>;
    recentFiles: (limit?: number) => Promise<any[]>;
  };

  checkpoint: {
    create: (files: string[], description: string) => Promise<any>;
    list: () => Promise<any>;
    get: (id: string) => Promise<any>;
    rollback: (checkpointId: string, strategy?: 'force' | 'preserve-manual-edits') => Promise<any>;
    delete: (id: string) => Promise<any>;
  };

  invoke: (channel: string, ...args: any[]) => Promise<any>;

  webServer: {
    getConfig: () => Promise<any>;
    saveConfig: (config: any) => Promise<any>;
    getStatus: () => Promise<any>;
    diagnose: () => Promise<any>;
  };
  indexing: {
    status: () => Promise<{ indexed: boolean; fileCount: number; indexedCount: number; lastUpdated: string | null; workspace: string }>;
    build: () => Promise<{ success: boolean; fileCount?: number; error?: string }>;
    getIgnore: () => Promise<{ content: string; exists: boolean }>;
    setIgnore: (content: string) => Promise<{ success: boolean; error?: string }>;
    liveProgress: () => Promise<any>;
    onProgress: (handler: (progress: any) => void) => () => void;
  };
  voice: {
    [key: string]: any;
    onInterimResult: (callback: (data: any) => void) => () => void;
    onFinalResult: (callback: (data: any) => void) => () => void;
    onStatusChange: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };

  cloud: {
    connect: (opts?: any) => Promise<any>;
    disconnect: () => Promise<any>;
    status: () => Promise<any>;
    sessions: {
      list: () => Promise<any[]>;
      get: (id: string) => Promise<any>;
      upsert: (session: any) => Promise<any>;
      delete: (id: string) => Promise<any>;
    };
    memories: {
      list: (query?: string) => Promise<any[]>;
      upsert: (memory: any) => Promise<any>;
      delete: (id: string) => Promise<any>;
    };
    webhook: {
      trigger: (channel: string, payload: any) => Promise<any>;
      logs: (channel: string) => Promise<any[]>;
    };
    pushSession: (session: { id: string; title?: string; messages?: any[]; metadata?: any }) => Promise<{ ok: boolean }>;
    pushMemory: (memory: { title: string; content: string; category?: string; scope?: string }) => Promise<{ ok: boolean }>;
    onStatus: (callback: (data: any) => void) => () => void;
    saveConfig: (config: { url?: string; apiKey?: string }) => Promise<{ ok: boolean }>;
    getConfig: () => Promise<{ url?: string; apiKey?: string }>;
    onSyncEvent: (callback: (data: any) => void) => () => void;
    onWebhookEvent: (callback: (data: any) => void) => () => void;
    api: (opts: { endpoint: string; method?: string; body?: unknown; token?: string; baseUrl?: string }) => Promise<any>;
    setUserToken: (token: string) => Promise<any>;
  };
}

declare interface Window {
  electronAPI: ElectronAPI;
  electron: { ipcRenderer: import("electron").IpcRenderer };
  __codepilot_project_path__?: string;
}

// Module declarations for @codepilot/core subpath exports

declare module '@codepilot/core/checkpoint' {
  export interface Checkpoint { id: string; description: string; createdAt: string; files: string[]; timestamp?: string }
  export function create(files: string[], description: string): Promise<Checkpoint>;
  export function list(): Promise<Checkpoint[]>;
  export function get(id: string): Promise<Checkpoint>;
  export function rollback(id: string, strategy?: 'force' | 'preserve-manual-edits'): Promise<any>;
  export interface RollbackResult { success: boolean; restoredFiles: string[]; errors?: string[]; conflicts?: string[]; message?: string }
}

declare module '@codepilot/core/context' {
  export interface ContextFile { id: string; type: string; label: string; path: string; content?: string }
  export function searchFiles(query: string, type: 'file' | 'folder'): Promise<ContextFile[]>;
  export function parseDocument(filePath: string): Promise<any>;
  export interface ContextUsage { used: number; total: number; percentage: number; utilizationPercent?: number; usedTokens?: number; maxTokens?: number }
}

declare module '@codepilot/core/completion' {
  export interface CompletionResult { text: string; score: number }
  export function generate(params: any): Promise<CompletionResult>;
  export type CompletionSessionState = "inactive" | "active" | "loading" | "error" | "completed" | "streaming" | "idle";
}

declare module '@codepilot/core/intent' {
  export type IntentType = 'chat' | 'edit' | 'command' | 'search' | 'agent';
  export function detectIntent(input: string): Promise<{ intent: IntentType; confidence: number }>;
  export type IntentMode = 'ask' | 'agent' | 'experts' | 'coding' | 'browsing' | 'debugging';
}
declare module '@codepilot/core/terminal-suggester' {
  export interface TerminalSuggestion { command: string; description: string; confidence: number; riskLevel?: string; estimatedTime?: string }
  export function suggest(input: string, context?: any): Promise<TerminalSuggestion[]>;
}

declare module '@codepilot/core/auto-fix' {
  export interface AutoFixResult { fixes: Array<{ file: string; line: number; original: string; fixed: string }> }
  export interface FixSuggestion { id: string; file: string; line: number; column?: number; original: string; fixed: string; description?: string; fixDescription?: string }
  export function analyze(error: string, code: string, filePath: string): Promise<AutoFixResult>;
}

declare module '@codepilot/core/multi-file-edit' {
  export interface MultiFileEdit { files: Array<{ path: string; edits: Array<{ range: [number, number, number, number]; text: string }> }> }
  export interface FileDiff { filePath: string; path: string; hasConflict?: boolean; hunks: Array<{ id?: string; oldStart: number; oldLines: number; newStart: number; newLines: number; lines: Array<{ type: string; content: string }>; decision?: string; content: string }> }
  export interface HunkDecision { hunkIndex: number; decision: "accept" | "reject" | "edit"; editedContent?: string }
  export interface MultiFileEditSession { files: FileDiff[]; decisions?: HunkDecision[] }
  export interface ApplyResult { success: boolean; errors?: Array<{ file: string; error: string }> }
  export function parse(content: string): MultiFileEdit;
}

declare module '@codepilot/core/agent-mode' {
  export type AgentMode = 'auto' | 'spec' | 'plan' | 'implement' | 'review';
  export interface ExecutionPlan { steps: Array<{ id: string; action: string; params: any; description?: string; status?: string; isHighRisk?: boolean; completedAt?: string; startedAt?: string }>; completedSteps?: number; totalSteps?: number }
  export type AgentExecutionState = string;
  export interface StepProgressEvent { stepId: string; status: string; result?: any; output?: any }
  export function detectMode(input: string): AgentMode;
}

declare module '@codepilot/core/voice' {
  export type VoiceSessionState = 'idle' | 'recording' | 'recognizing' | 'processing' | 'broadcasting' | 'confirming';
  export type InteractionMode = 'text' | 'voice' | 'hybrid';
  export type ASREngineType = 'local' | 'cloud' | 'web-speech';
  export type TTSEngineType = 'local' | 'cloud' | 'web-speech';
  export type VoiceSessionEvent = string;
  export interface VoiceEngineConfig { engine: string; language?: string }
  export interface ASRResult { transcript: string; confidence: number; isFinal: boolean }
  export class VoiceSessionStateMachine { constructor(); transition(event: string): void; getState(): VoiceSessionState; }
}


declare module "monaco-editor" {
  export = Monaco;
  export as namespace Monaco;
  declare namespace Monaco {
    export namespace editor {
      let _: any;
      export type IStandaloneCodeEditor = any;
      export type IStandaloneDiffEditor = any;
      export type ITextModel = any;
      export type IModelDeltaDecoration = any;
      export const OverviewRulerLane: any;
    }
    export namespace languages {
      let _: any;
      export type InlineCompletion = any;
      export type InlineCompletionContext = any;
      export type InlineCompletions = any;
      export type InlineCompletionsProvider = any;
    }
    export type Range = any;
    export type Position = any;
    export type IPosition = any;
    export type CancellationToken = any;
    export type IDisposable = any;
    export const KeyCode: any;
    export const KeyMod: any;
    export const Range: any;
    export namespace Uri {
      export function parse(value: string): any;
      export function from(components: any): any;
      export function file(path: string): any;
    }
  }
}
