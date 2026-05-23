// IPC client - typed wrappers for Electron IPC calls
// These map to the API exposed by preload.ts via contextBridge

export interface AgentEventData {
  type: 'thinking' | 'text' | 'tool_start' | 'tool_progress' | 'tool_end' | 'usage' | 'error' | 'done' | 'todo_update'
    | 'expert_dispatch_start' | 'expert_task_start' | 'expert_task_progress' | 'expert_task_end' | 'expert_dispatch_end'
    | 'intervention_injected' | 'file_snapshot';
  text?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: { content: string; isError?: boolean };
  inputTokens?: number;
  outputTokens?: number;
  error?: { message: string };
  items?: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' }>;
  // Expert event fields
  taskId?: string;
  expertType?: string;
  title?: string;
  taskCount?: number;
  tasks?: Array<{ id: string; expertType: string; title: string }>;
  totalTasks?: number;
  succeeded?: number;
  failed?: number;
  isError?: boolean;
  // File snapshot fields (diff review)
  filePath?: string;
  beforeContent?: string | null;
  afterContent?: string;
  toolName?: string;
  isNewFile?: boolean;
}

export interface AskUserData {
  requestId: string;
  question: string;
}

export interface ConfirmationRequestData {
  requestId: string;
  type: 'bash' | 'mcp' | 'plan';
  toolName: string;
  args: Record<string, unknown>;
  command?: string;
  planContent?: string;
  planTitle?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export interface FileChangeEvent {
  path: string;
  type: 'add' | 'change' | 'unlink';
}

export interface AgentRunOptions {
  mode?: 'ask' | 'agent' | 'experts';
  contexts?: Array<{ id: string; type: string; label: string; path: string; content?: string }>;
  images?: Array<{ data: string; mediaType: string }>;
  documents?: Array<{ name: string; content: string; ext?: string }>;
  conversationId?: string;
  conversationMessages?: any[];
}

export interface ElectronAPI {
  agent: {
    run: (message: string, options?: AgentRunOptions) => Promise<void>;
    abort: () => Promise<void>;
    resetConversation: () => Promise<void>;
    onEvent: (callback: (event: AgentEventData) => void) => () => void;
    onAskUser: (callback: (data: AskUserData) => void) => () => void;
    replyAskUser: (requestId: string, answer: string) => Promise<void>;
    confirmReply: (requestId: string, approved: boolean, feedback?: string) => Promise<void>;
    onConfirmRequest: (callback: (data: ConfirmationRequestData) => void) => () => void;
    sendIntervention: (text: string) => Promise<{ success: boolean }>;
  };
  fs: {
    readDir: (path: string) => Promise<FileEntry[]>;
    readFile: (path: string) => Promise<{ content: string; language: string }>;
    writeFile: (path: string, content: string) => Promise<void>;
    onChanged: (callback: (event: FileChangeEvent) => void) => () => void;
    selectFolder: () => Promise<string | null>;
    selectFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string[] | null>;
    saveAs: (defaultName?: string) => Promise<string | null>;
  };
  terminal: {
    create: (cwd?: string) => Promise<{ terminalId: string }>;
    input: (terminalId: string, data: string) => Promise<void>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
    destroy: (terminalId: string) => Promise<void>;
    onData: (callback: (data: { terminalId: string; data: string }) => void) => () => void;
  };
  config: {
    get: () => Promise<Record<string, unknown>>;
    set: (key: string, value: unknown) => Promise<void>;
    getWorkspace: () => Promise<string | null>;
    setWorkspace: (path: string) => Promise<void>;
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
    check: () => Promise<{ error?: string }>;
    download: () => Promise<{ error?: string }>;
    install: () => Promise<void>;
    setAutoDownload: (enabled: boolean) => Promise<void>;
    onChecking: (callback: () => void) => () => void;
    onAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;
    onNotAvailable: (callback: () => void) => () => void;
    onProgress: (callback: (info: { percent: number; transferred: number; total: number }) => void) => () => void;
    onDownloaded: (callback: (info: { version: string }) => void) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
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
    register: (username: string, password: string, email?: string) => Promise<AuthResult>;
    login: (username: string, password: string) => Promise<AuthResult>;
    verify: (token: string) => Promise<{ valid: boolean; user?: UserRecord }>;
  };
  conversation: {
    save: (userId: number, conversationId: string, title: string, messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean }>;
    saveSync: (userId: number, conversationId: string, title: string, messages: any[]) => any;
    list: (userId: number) => Promise<Array<{ id: string; title: string; updatedAt: string }>>;
    load: (conversationId: string) => Promise<Array<{ role: string; content: string }>>;
    delete: (conversationId: string) => Promise<{ success: boolean }>;
    rename: (conversationId: string, newTitle: string) => Promise<{ success: boolean }>;
  };
  mcp: {
    connect: (name: string, config: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      type?: 'stdio' | 'sse' | 'streamable-http';
      url?: string;
      headers?: Record<string, string>;
      timeout?: number;
    }) => Promise<{ success: boolean; error?: string; tools?: Array<{ name: string; description?: string }> }>;
    disconnect: (name: string) => Promise<{ success: boolean }>;
    listServers: () => Promise<Array<{ name: string; tools: Array<{ name: string; description?: string }> }>>;
    listSaved: () => Promise<Array<{ name: string; config: any; connected: boolean }>>;
    listStates: () => Promise<any[]>;
    callTool: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<any>;
    marketplaceList: () => Promise<any[]>;
    marketplaceInstall: (id: string, env?: Record<string, string>) => Promise<any>;
    onChromiumInstallProgress: (callback: (data: any) => void) => () => void;
  };
  ollama: {
    listModels: () => Promise<{ models: Array<{ name: string; size: number; modifiedAt: string }>; error?: string | null }>;
  };
  git: {
    init: () => Promise<any>;
    status: () => Promise<GitStatus>;
    log: (count?: number) => Promise<Array<{ hash: string; shortHash: string; message: string; author: string; date: string }>>;
    add: (paths: string[]) => Promise<any>;
    addAll: () => Promise<any>;
    commit: (message: string) => Promise<any>;
  };
  tools: {
    list: () => Promise<Array<{ name: string; description: string }>>;
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
    list: (opts?: { scope?: string; projectPath?: string }) => Promise<Array<MemoryRecord>>;
    search: (query: string, scope?: string, projectPath?: string) => Promise<Array<MemoryRecord>>;
    add: (mem: { scope: string; projectPath?: string; category: string; title: string; content: string; source: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    clear: (opts?: { scope?: string; projectPath?: string }) => Promise<{ success: boolean; error?: string }>;
  };
  skills: {
    list: () => Promise<Array<SkillRecord>>;
    listFull: () => Promise<Array<SkillConfigFull>>;
    catalog: () => Promise<Array<SkillCatalogEntry>>;
    listAgents: () => Promise<Array<AgentRecord>>;
    listAgentsFull: () => Promise<Array<AgentRecord>>;
    create: (opts: { name: string; description: string; level: string; content?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
    createAgent: (opts: { name: string; description: string; level: string; systemPrompt?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
    saveAgent: (opts: { path: string; name: string; description: string; tools: string[]; skills: string[]; mcpServers: string[]; maxTurns: number; temperature: number; systemPrompt: string }) => Promise<{ success: boolean; error?: string }>;
    delete: (path: string) => Promise<{ success: boolean; error?: string }>;
    read: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    readAgent: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  };
  indexing: {
    status: () => Promise<IndexingStatus>;
    build: () => Promise<{ success: boolean; fileCount?: number; error?: string }>;
    getIgnore: () => Promise<{ content: string; exists: boolean }>;
    setIgnore: (content: string) => Promise<{ success: boolean; error?: string }>;
    liveProgress: () => Promise<any>;
    onProgress: (handler: (progress: any) => void) => () => void;
  };
  integrations: {
    githubValidate: (token: string) => Promise<{ valid: boolean; username?: string; avatar?: string; error?: string }>;
    githubGetSavedToken: () => Promise<any>;
    githubConnect: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;
    githubDisconnect: () => Promise<{ success: boolean; error?: string }>;
    supabaseValidate: (projectUrl: string, anonKey: string) => Promise<{ valid: boolean; error?: string }>;
    supabaseConnect: (projectUrl: string, anonKey: string) => Promise<{ success: boolean; error?: string }>;
    supabaseDisconnect: () => Promise<{ success: boolean; error?: string }>;
  };
  context: {
    searchFiles: (query: string, type: 'file' | 'folder') => Promise<Array<{ name: string; path: string; isDirectory: boolean; size?: number }>>;
    listRules: () => Promise<Array<{ id: string; name: string; type: string; description?: string; filePath?: string; enabled: boolean; source: string }>>;
    createRule: (name: string, content: string) => Promise<any>;
    parseDocument: (filePath: string) => Promise<{ content: string; type: string }>;
    gitChangedFiles: () => Promise<Array<{ name: string; path: string; status: string }>>;
    recentFiles: (limit?: number) => Promise<Array<{ name: string; path: string }>>;
  };
  webServer: {
    getConfig: () => Promise<{ enabled: boolean; port: number; token: string; frpEnabled: boolean; frpServerAddr: string; frpServerPort: number; frpRemotePort: number; frpToken: string; frpCustomDomain: string }>;
    saveConfig: (config: any) => Promise<{ success: boolean }>;
    getStatus: () => Promise<{ webServerRunning: boolean; frp: { running: boolean; config: any } }>;
    diagnose: () => Promise<{ config: any; diagnostics: { startAttempted: boolean; startSucceeded: boolean; functionsInitialized: boolean; errors: Array<{ stage: string; message: string; time: string }>; configLoaded: boolean; currentPort: number; listenAttempts: number }; webServerRunning: boolean }>;
  };
  network: {
    diagnose: () => Promise<NetworkDiagResult>;
  };
  diagnostics: {
    get: (opts: { filePath?: string; severity?: string }) => Promise<{ success: boolean; diagnostics?: string; error?: string }>;
    checkServers: () => Promise<{ success: boolean; servers?: Array<{ name: string; available: boolean }>; error?: string }>;
    onUpdate: (callback: (data: any) => void) => () => void;
    offUpdate: (callback: (data: any) => void) => void;
  };
  diffReview: {
    revert: (filePath: string, content: string) => Promise<void>;
    delete: (filePath: string) => Promise<void>;
  };
  inlineChat: {
    generate: (params: InlineChatRequest) => Promise<InlineChatResponse>;
    abort: () => Promise<void>;
  };
  completion: {
    inline: (params: CompletionRequest) => Promise<CompletionResponse>;
    abort: () => Promise<void>;
    accept: () => void;
    acceptWord: () => void;
    reject: () => void;
    crossFile: (params: CrossFileRequest) => Promise<CrossFileResponse>;
  };
  compact: {
    summarize: (messages: Array<{ role: string; content: string }>, language?: string) =>
      Promise<CompactSummarizeResponse>;
  };
  prompt: {
    polish: (text: string) => Promise<{ polished: string; error: string | null }>;
  };
  quest: {
    createTask: (params: { scenario: string; runMode: string; autoMode: string; title?: string }) =>
      Promise<{ id: string; title: string; createdAt: string; updatedAt: string }>;
    listTasks: () => Promise<QuestTaskRecord[]>;
    loadTask: (taskId: string) => Promise<QuestMessageRecord[]>;
    deleteTask: (taskId: string) => Promise<{ success: boolean }>;
    renameTask: (taskId: string, title: string) => Promise<{ success: boolean }>;
    run: (params: any) => Promise<void>;
    abort: (taskId: string) => Promise<void>;
    pause: (taskId: string) => Promise<void>;
    resume: (taskId: string, message?: string, runId?: string) => Promise<void>;
    updateSpec: (taskId: string, content: string) => Promise<{ success: boolean }>;
    confirmReply: (requestId: string, approved: boolean, feedback?: string) => Promise<void>;
    replyAskUser: (requestId: string, answer: string) => Promise<void>;
    sendIntervention: (taskId: string, text: string) => Promise<{ success: boolean }>;
    saveMessages: (taskId: string) => Promise<any>;
    stopOnSwitch: (taskId: string, runId?: string) => Promise<any>;
    cleanup: (taskId: string) => Promise<any>;
    onEvent: (callback: (event: QuestEventData) => void) => () => void;
    onAskUser: (callback: (data: AskUserData) => void) => () => void;
    onConfirmRequest: (callback: (data: ConfirmationRequestData) => void) => () => void;
    onLog: (callback: (data: any) => void) => () => void;
  };
  wiki: {
    status: () => Promise<WikiStatus>;
    generate: () => Promise<void>;
    detectChanges: () => Promise<WikiChangeDetection>;
    update: (params?: { modules?: string[] }) => Promise<void>;
    checkSync: () => Promise<{ editedFiles: string[] }>;
    loadToc: () => Promise<{ modules: WikiTocEntry[]; hasOverview: boolean }>;
    loadContent: (modulePath: string) => Promise<{ content: string }>;
    abort: () => Promise<void>;
    onEvent: (callback: (event: WikiEventData) => void) => () => void;
  };
  browser: {
    initialize: () => Promise<void>;
    execute: (operation: string, params: Record<string, unknown>) => Promise<any>;
    shutdown: () => Promise<void>;
    getState: () => Promise<any>;
    onScreenshot: (callback: (data: any) => void) => () => void;
    onStatus: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };
  plan: {
    update: (planId: string, updates: Record<string, unknown>) => Promise<{ success: boolean; plan?: any; error?: string }>;
    approve: (planId: string) => Promise<{ success: boolean; error?: string }>;
    pause: (planId: string) => Promise<{ success: boolean; error?: string }>;
    resume: (planId: string) => Promise<{ success: boolean; error?: string }>;
    cancel: (planId: string) => Promise<{ success: boolean; error?: string }>;
    export: (planId: string) => Promise<{ success: boolean; planData?: any; error?: string }>;
    import: (planData: Record<string, unknown>) => Promise<{ success: boolean; plan?: any; error?: string }>;
    delete: (planId: string, workingDirectory: string) => Promise<any>;
    load: (planId: string, workingDirectory: string) => Promise<any>;
    templates: () => Promise<{ success: boolean; templates?: Array<{ id: string; name: string; description?: string; goals?: string[]; steps?: any[] }>; error?: string }>;
  };
  ssh: {
    listConnections: () => Promise<Array<{ id: string; name: string; host: string; port: number; username: string; authMethod: 'password' | 'privateKey'; status?: 'connected' | 'disconnected' | 'connecting' }>>;
    saveConnection: (form: { id?: string; name: string; host: string; port: number; username: string; authMethod: 'password' | 'privateKey'; password?: string; privateKey?: string }) => Promise<{ id: string; name: string; host: string; port: number; username: string; authMethod: 'password' | 'privateKey' }>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (form: { name: string; host: string; port: number; username: string; authMethod: 'password' | 'privateKey'; password?: string; privateKey?: string }) => Promise<{ success: boolean; error?: string }>;
    connect: (connectionId: string) => Promise<{ sshTerminalId: string; name: string; host: string; username: string }>;
    disconnect: (sshTerminalId: string) => Promise<void>;
    terminalInput: (sshTerminalId: string, data: string) => Promise<void>;
    terminalResize: (sshTerminalId: string, cols: number, rows: number) => Promise<void>;
    onTerminalData: (callback: (data: { sshTerminalId: string; data: string }) => void) => () => void;
    onTerminalClosed: (callback: (data: { sshTerminalId: string }) => void) => () => void;
    readDir: (sshTerminalId: string, path: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean; size?: number; mtime?: number }>>;
    readFile: (sshTerminalId: string, path: string) => Promise<{ content: string; language: string }>;
    writeFile: (sshTerminalId: string, path: string, content: string) => Promise<void>;
    stat: (sshTerminalId: string, path: string) => Promise<{ path: string; isFile: boolean; isDirectory: boolean; size: number; mtime: Date; permissions: string }>;
    mkdir: (sshTerminalId: string, path: string) => Promise<void>;
    delete: (sshTerminalId: string, path: string) => Promise<void>;
    rename: (sshTerminalId: string, oldPath: string, newPath: string) => Promise<void>;
    setWorkspace: (sshTerminalId: string, path: string) => Promise<void>;
    getWorkspace: (sshTerminalId: string) => Promise<{ path?: string }>;
    exec: (sshTerminalId: string, command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
  };
  checkpoint: {
    create: (files: string[], description: string) => Promise<any>;
    list: () => Promise<any>;
    get: (id: string) => Promise<any>;
    rollback: (checkpointId: string, strategy?: 'force' | 'preserve-manual-edits') => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
  voice: {
    [key: string]: any;
    onInterimResult: (callback: (data: any) => void) => () => void;
    onFinalResult: (callback: (data: any) => void) => () => void;
    onStatusChange: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
  };
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  subscription: {
    status: (token: string) => Promise<{ planId: string; planName: string; status: string; endDate?: string; price?: number }>;
    plans: () => Promise<Array<{ id: string; name: string; price: number; billingCycle: string; features: Array<{ name: string; desc?: string; included: boolean }>; recommended: boolean }>>;
    create: (params: { token: string; planId: string; billingCycle?: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
    cancel: (token: string) => Promise<{ ok: boolean; error?: string }>;
    payments: (token: string) => Promise<Array<{ id: string; amount: number; status: string; createdAt: string }>>;
    offlinePayment: (params: { token: string; amount: number; companyName: string; bankName?: string; bankAccount?: string; remark?: string; receiptUrl?: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
  };
  cloud: {
    connect: (opts?: any) => Promise<any>;
    disconnect: () => Promise<{ ok: boolean }>;
    status: () => Promise<{ connected: boolean; healthy?: boolean }>;
    sessions: {
      list: () => Promise<any[]>;
      get: (id: string) => Promise<any>;
      upsert: (session: { id: string; title?: string; messages?: any[]; metadata?: any }) => Promise<any>;
      delete: (id: string) => Promise<any>;
    };
    memories: {
      list: (query?: string) => Promise<any[]>;
      upsert: (memory: { id?: string; title: string; content: string; category?: string; scope?: string }) => Promise<any>;
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

export interface CompactSummarizeResponse {
  summary: string;
  estimatedTokens: number;
  error: string | null;
}

// --- Wiki Types ---

export interface WikiEventData {
  type: 'progress' | 'error';
  phase?: 'scanning' | 'generating' | 'overview' | 'updating' | 'done';
  current?: number;
  total?: number;
  modulePath?: string;
  message?: string;
  error?: string;
}

export interface WikiStatus {
  hasWiki: boolean;
  language: string;
  moduleCount: number;
  baseCommit: string;
  generatedAt: string;
}

export interface WikiTocEntry {
  path: string;
  title: string;
  fileCount: number;
}

export interface WikiChangeDetection {
  changedModules: string[];
  baseCommit: string;
  currentCommit: string;
}

// --- Quest Mode Types ---

export interface QuestTaskRecord {
  id: string;
  title: string;
  scenario: string;
  run_mode: string;
  auto_mode: string;
  status: string;
  spec_content: string | null;
  worktree_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestMessageRecord {
  id: number;
  task_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  created_at: string;
}

export interface QuestEventData {
  type: string;
  text?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: { content: string; isError?: boolean };
  inputTokens?: number;
  outputTokens?: number;
  error?: { message: string };
  items?: Array<{ content: string; status: string }>;
  taskId?: string;
  // Spec event
  specContent?: string;
  // Status change
  status?: string;
  // File snapshot
  filePath?: string;
  beforeContent?: string | null;
  afterContent?: string;
  toolName?: string;
  isNewFile?: boolean;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: UserRecord;
  error?: string;
}

export interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  modified: number;
  untracked: number;
  staged: number;
}

export interface MemoryRecord {
  id: string;
  scope: 'global' | 'project';
  project_path: string | null;
  category: string;
  title: string;
  content: string;
  source: 'active' | 'automatic';
  created_at: string;
  updated_at: string;
}

export interface SkillRecord {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  level: 'user' | 'project';
  path: string;
  hasSkillMd: boolean;
}

export interface SkillConfigFull {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  instructions: string;
  level: 'user' | 'project';
  path: string;
}

export interface SkillCatalogEntry {
  name: string;
  description: string;
  triggers: string[];
  level: 'user' | 'project';
  path: string;
}

export interface AgentRecord {
  name: string;
  description: string;
  level: 'user' | 'project';
  path: string;
  // Extended fields for custom agents
  tools?: string[];
  skills?: string[];
  mcpServers?: string[];
  maxTurns?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface IndexingStatus {
  indexed: boolean;
  fileCount: number;
  indexedCount: number;
  lastUpdated: string | null;
  workspace: string;
}

export interface NetworkDiagItem {
  name: string;
  ok: boolean;
  latency: number;
  detail: string;
}

export interface NetworkDiagResult {
  results: NetworkDiagItem[];
  logs: string[];
}

export interface InlineChatRequest {
  prompt: string;
  filePath: string;
  language: string;
  scenario: 'modify' | 'add';
  selectedCode?: string;
  selectionRange?: { startLine: number; endLine: number; startCol: number; endCol: number };
  cursorLine?: number;
  contextFiles?: string[];
  surroundingCode: { prefix: string; suffix: string };
}

export interface InlineChatResponse {
  code: string;
  error: string | null;
}

export interface CompletionRequest {
  prefix: string;
  suffix: string;
  filePath: string;
  language: string;
  recentChanges?: Array<{
    filePath: string;
    oldText: string;
    newText: string;
  }>;
  maxTokens?: number;
}

export interface CompletionResponse {
  text: string;
  error: string | null;
}

export interface CrossFileRequest {
  changedFile: string;
  changeDescription: string;
  relatedFiles: Array<{
    filePath: string;
    content: string;
  }>;
}

export interface CrossFileEdit {
  filePath: string;
  startLine: number;
  endLine: number;
  newText: string;
}

export interface CrossFileResponse {
  edits: CrossFileEdit[];
  error: string | null;
}

// --- Code Review Types ---

export interface CodeReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'security' | 'performance' | 'correctness' | 'style' | 'best_practices';
  title: string;
  file: string;
  line?: number;
  code_snippet?: string;
  description: string;
  suggestion: string;
}

export interface CodeReviewReport {
  summary: string;
  score?: number;
  total_issues: number;
  severity_counts: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  issues: CodeReviewIssue[];
  positives: string[];
  scope: string;
}

// Window.electronAPI declared in types/electron.d.ts
