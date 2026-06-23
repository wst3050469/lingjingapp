// Electron preload script - exposes typed API to renderer via contextBridge

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke passthrough for Fusion panels and dynamic IPC callers
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  agent: {
    run: (message: string, options?: { mode?: string; conversationId?: string; contexts?: Array<{ id: string; type: string; label: string; path: string; content?: string }>; images?: Array<{ data: string; mediaType: string }> }) =>
      ipcRenderer.invoke('agent:run', { message, ...options }),
    abort: () => ipcRenderer.invoke('agent:abort'),
    resetConversation: () => ipcRenderer.invoke('agent:reset-conversation'),
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:event', handler);
      return () => ipcRenderer.removeListener('agent:event', handler);
    },
    onAskUser: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:ask-user', handler);
      return () => ipcRenderer.removeListener('agent:ask-user', handler);
    },
    replyAskUser: (requestId: string, answer: string) =>
      ipcRenderer.invoke('agent:ask-user:reply', { requestId, answer }),
    confirmReply: (requestId: string, approved: boolean, feedback?: string) =>
      ipcRenderer.invoke('agent:confirm:reply', { requestId, approved, feedback }),
    onConfirmRequest: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:confirm-request', handler);
      return () => ipcRenderer.removeListener('agent:confirm-request', handler);
    },
    sendIntervention: (text: string) =>
      ipcRenderer.invoke('agent:intervention', { text }),
  },

  fs: {
    readDir: (path: string) => ipcRenderer.invoke('fs:read-dir', { path }),
    readFile: (path: string) => ipcRenderer.invoke('fs:read-file', { path }),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:write-file', { path, content }),
    onChanged: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('fs:changed', handler);
      return () => ipcRenderer.removeListener('fs:changed', handler);
    },
    selectFolder: () => ipcRenderer.invoke('fs:select-folder'),
    selectFile: () => ipcRenderer.invoke('fs:select-file'),
    saveAs: (defaultName?: string) => ipcRenderer.invoke('fs:save-as', { defaultName }),
  },

  terminal: {
    create: (cwd?: string, command?: string) => ipcRenderer.invoke('terminal:create', { cwd, command }),
    input: (terminalId: string, data: string) =>
      ipcRenderer.invoke('terminal:input', { terminalId, data }),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', { terminalId, cols, rows }),
    destroy: (terminalId: string) =>
      ipcRenderer.invoke('terminal:destroy', { terminalId }),
    onData: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('config:set', { key, value }),
    getWorkspace: () => ipcRenderer.invoke('config:get-workspace'),
    setWorkspace: (path: string) =>
      ipcRenderer.invoke('config:set-workspace', { path }),
    reset: () => ipcRenderer.invoke('config:reset'),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    platform: () => ipcRenderer.invoke('app:platform'),
    onLog: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('app:log', handler);
      return () => ipcRenderer.removeListener('app:log', handler);
    },
    onDbStatus: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('app:db-status', handler);
      return () => ipcRenderer.removeListener('app:db-status', handler);
    },
    onWindowBeforeClose: (callback: () => void | Promise<void>) => {
      const handler = () => callback();
      ipcRenderer.on('window:before-close', handler);
      return () => ipcRenderer.removeListener('window:before-close', handler);
    },
    confirmWindowClose: () => {
      ipcRenderer.send('window:close-confirmed');
    },
  },

  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    setAutoDownload: (enabled: boolean) =>
      ipcRenderer.invoke('update:set-auto-download', enabled),
    onChecking: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:checking', handler);
      return () => ipcRenderer.removeListener('update:checking', handler);
    },
    onAvailable: (callback: (info: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    onNotAvailable: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:not-available', handler);
      return () => ipcRenderer.removeListener('update:not-available', handler);
    },
    onProgress: (callback: (info: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    onDownloaded: (callback: (info: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
    onError: (callback: (error: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },
    exportSkills: (targetDir: string) =>
      ipcRenderer.invoke('update:export-skills', { targetDir }),
  },

  window: {
    newWindow: () => ipcRenderer.invoke('window:new'),
    close: () => ipcRenderer.invoke('window:close'),
    zoomIn: () => ipcRenderer.invoke('window:zoom-in'),
    zoomOut: () => ipcRenderer.invoke('window:zoom-out'),
    zoomReset: () => ipcRenderer.invoke('window:zoom-reset'),
    openDevTools: () => ipcRenderer.invoke('window:open-devtools'),
  },

  auth: {
    register: (username: string, password: string, email?: string) =>
      ipcRenderer.invoke('auth:register', { username, password, email }),
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', { username, password }),
    verify: (token: string) =>
      ipcRenderer.invoke('auth:verify', { token }),
  },

  conversation: {
    save: (userId: number, conversationId: string, title: string, messages: any[]) =>
      ipcRenderer.invoke('conversation:save', { userId, conversationId, title, messages }),
    saveSync: (userId: number, conversationId: string, title: string, messages: any[]) =>
      ipcRenderer.sendSync('conversation:save-sync', { userId, conversationId, title, messages }),
    list: (userId: number) =>
      ipcRenderer.invoke('conversation:list', { userId }),
    load: (conversationId: string) =>
      ipcRenderer.invoke('conversation:load', { conversationId }),
    delete: (conversationId: string) =>
      ipcRenderer.invoke('conversation:delete', { conversationId }),
    rename: (conversationId: string, newTitle: string) =>
      ipcRenderer.invoke('conversation:rename', { conversationId, newTitle }),
  },

  mcp: {
    connect: (name: string, config: any) =>
      ipcRenderer.invoke('mcp:connect', { name, config }),
    disconnect: (name: string) =>
      ipcRenderer.invoke('mcp:disconnect', { name }),
    listServers: () =>
      ipcRenderer.invoke('mcp:list-servers'),
    listSaved: () =>
      ipcRenderer.invoke('mcp:list-saved'),
    listStates: () =>
      ipcRenderer.invoke('mcp:list-states'),
    callTool: (serverName: string, toolName: string, args: Record<string, unknown>) =>
      ipcRenderer.invoke('mcp:call-tool', { serverName, toolName, args }),
    marketplaceList: () =>
      ipcRenderer.invoke('mcp:marketplace:list'),
    marketplaceInstall: (id: string, env?: Record<string, string>) =>
      ipcRenderer.invoke('mcp:marketplace:install', { id, env }),
    onChromiumInstallProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('mcp:chromium-install-progress', handler);
      return () => ipcRenderer.removeListener('mcp:chromium-install-progress', handler);
    },
  },

  ollama: {
    listModels: () => ipcRenderer.invoke('ollama:list-models'),
  },

  git: {
    status: () => ipcRenderer.invoke('git:status'),
    log: (count?: number) => ipcRenderer.invoke('git:log', { count }),
    init: () => ipcRenderer.invoke('git:init'),
    add: (paths: string[]) => ipcRenderer.invoke('git:add', { paths }),
    addAll: () => ipcRenderer.invoke('git:addAll'),
    commit: (message: string) => ipcRenderer.invoke('git:commit', { message }),
  },

  tools: {
    list: () => ipcRenderer.invoke('tools:list'),
  },

  memory: {
    list: (opts?: { scope?: string; projectPath?: string }) =>
      ipcRenderer.invoke('memory:list', opts),
    search: (query: string, scope?: string, projectPath?: string) =>
      ipcRenderer.invoke('memory:search', { query, scope, projectPath }),
    add: (mem: { scope: string; projectPath?: string; category: string; title: string; content: string; source: string }) =>
      ipcRenderer.invoke('memory:add', mem),
    delete: (id: string) =>
      ipcRenderer.invoke('memory:delete', { id }),
    clear: (opts?: { scope?: string; projectPath?: string }) =>
      ipcRenderer.invoke('memory:clear', opts),
  },

  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    listFull: () => ipcRenderer.invoke('skills:list-full'),
    catalog: () => ipcRenderer.invoke('skills:catalog'),
    listAgents: () => ipcRenderer.invoke('skills:list-agents'),
    listAgentsFull: () => ipcRenderer.invoke('skills:list-agents-full'),
    create: (opts: { name: string; description: string; level: string; content?: string }) =>
      ipcRenderer.invoke('skills:create', opts),
    createAgent: (opts: { name: string; description: string; level: string; systemPrompt?: string }) =>
      ipcRenderer.invoke('skills:create-agent', opts),
    saveAgent: (opts: { path: string; name: string; description: string; tools: string[]; skills: string[]; mcpServers: string[]; maxTurns: number; temperature: number; systemPrompt: string }) =>
      ipcRenderer.invoke('skills:save-agent', opts),
    delete: (path: string) =>
      ipcRenderer.invoke('skills:delete', { path }),
    read: (path: string) =>
      ipcRenderer.invoke('skills:read', { path }),
    readAgent: (path: string) =>
      ipcRenderer.invoke('skills:read-agent', { path }),
    leaderboard: () =>
      ipcRenderer.invoke('skills:leaderboard'),
    incrementUsage: (skillName: string) =>
      ipcRenderer.invoke('skills:increment-usage', { skillName }),
    exportBuiltin: (targetDir: string) =>
      ipcRenderer.invoke('skills:export-builtin', { targetDir }),
  },

  skillMarket: {
    getLeaderboard: (opts: { page?: number; limit?: number }) =>
      ipcRenderer.invoke('skill-market:get-leaderboard', opts),
    search: (opts: { query?: string; page?: number; limit?: number }) =>
      ipcRenderer.invoke('skill-market:search', opts),
    getInstalledSkillIds: () =>
      ipcRenderer.invoke('skill-market:get-installed-ids'),
    install: (opts: { skillId: string; skill: any }) =>
      ipcRenderer.invoke('skill-market:install', opts),
    installFromGithub: (opts: { url: string }) =>
      ipcRenderer.invoke('skill-market:install-from-github', opts),
    checkUpdates: () =>
      ipcRenderer.invoke('skill-market:check-updates'),
    update: (opts: { skillPath: string }) =>
      ipcRenderer.invoke('skill-market:update', opts),
    onGithubImportProgress: (callback: (data: { step: string; detail?: string; timestamp: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('skill-market:github-import-progress', handler);
      return () => ipcRenderer.removeListener('skill-market:github-import-progress', handler);
    },
  },

  indexing: {
    status: () => ipcRenderer.invoke('indexing:status'),
    build: () => ipcRenderer.invoke('indexing:build'),
    getIgnore: () => ipcRenderer.invoke('indexing:get-ignore'),
    setIgnore: (content: string) => ipcRenderer.invoke('indexing:set-ignore', { content }),
    liveProgress: () => ipcRenderer.invoke('indexing:live-progress'),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('indexing:progress', handler);
      return () => ipcRenderer.removeListener('indexing:progress', handler);
    },
  },

  integrations: {
    githubValidate: (token: string) =>
      ipcRenderer.invoke('integrations:github-validate', { token }),
    githubConnect: (token: string) =>
      ipcRenderer.invoke('integrations:github-connect', { token }),
    githubDisconnect: () =>
      ipcRenderer.invoke('integrations:github-disconnect'),
    githubGetSavedToken: () =>
      ipcRenderer.invoke('integrations:github-get-saved-token'),
    supabaseValidate: (projectUrl: string, anonKey: string) =>
      ipcRenderer.invoke('integrations:supabase-validate', { projectUrl, anonKey }),
    supabaseConnect: (projectUrl: string, anonKey: string) =>
      ipcRenderer.invoke('integrations:supabase-connect', { projectUrl, anonKey }),
    supabaseDisconnect: () =>
      ipcRenderer.invoke('integrations:supabase-disconnect'),
  },

  cloudSync: {
    init: () => ipcRenderer.invoke('cloud-sync:init'),
    push: (dataType: string, operation: string, payload: any) =>
      ipcRenderer.invoke('cloud-sync:push', dataType, operation, payload),
    pull: (dataType: string, dataId: string) =>
      ipcRenderer.invoke('cloud-sync:pull', dataType, dataId),
    syncNow: () => ipcRenderer.invoke('cloud-sync:sync-now'),
    getProgress: () => ipcRenderer.invoke('cloud-sync:get-progress'),
    subscribe: (channel: string, callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on(`cloud-sync:${channel}`, handler);
      return () => {
        ipcRenderer.removeListener(`cloud-sync:${channel}`, handler);
        ipcRenderer.send('cloud-sync:unsubscribe');
      };
    },
  },

  github: {
    generateAuthUrl: (scopes?: string[]) =>
      ipcRenderer.invoke('github:generate-auth-url', scopes),
    handleCallback: (code: string, state: string) =>
      ipcRenderer.invoke('github:handle-callback', code, state),
    getUser: () => ipcRenderer.invoke('github:get-user'),
    getRepositories: () => ipcRenderer.invoke('github:get-repositories'),
    createRepository: (name: string, options?: any) =>
      ipcRenderer.invoke('github:create-repository', name, options),
    getFile: (owner: string, repo: string, path: string, ref?: string) =>
      ipcRenderer.invoke('github:get-file', owner, repo, path, ref),
    putFile: (owner: string, repo: string, path: string, content: string, message: string, sha?: string) =>
      ipcRenderer.invoke('github:put-file', owner, repo, path, content, message, sha),
    listAccounts: () => ipcRenderer.invoke('github:list-accounts'),
    switchAccount: (accountId: string) =>
      ipcRenderer.invoke('github:switch-account', accountId),
    removeAccount: (accountId: string) =>
      ipcRenderer.invoke('github:remove-account', accountId),
    getSavedToken: (accountId: string) =>
      ipcRenderer.invoke('github:get-saved-token', accountId),
  },

  network: {
    diagnose: () => ipcRenderer.invoke('network:diagnose'),
  },

  diagnostics: {
    get: (opts: { filePath?: string; severity?: string }) =>
      ipcRenderer.invoke('diagnostics:get', opts),
    checkServers: () =>
      ipcRenderer.invoke('diagnostics:check-servers'),
    onUpdate: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('diagnostics:update', handler);
      return () => ipcRenderer.removeListener('diagnostics:update', handler);
    },
    offUpdate: (callback: (data: any) => void) => {
      ipcRenderer.removeAllListeners('diagnostics:update');
    },
  },

  diffReview: {
    revert: (filePath: string, content: string) =>
      ipcRenderer.invoke('diff-review:revert', { filePath, content }),
    delete: (filePath: string) =>
      ipcRenderer.invoke('diff-review:delete', { filePath }),
  },

  inlineChat: {
    generate: (params: {
      prompt: string;
      filePath: string;
      language: string;
      scenario: 'modify' | 'add';
      selectedCode?: string;
      selectionRange?: { startLine: number; endLine: number; startCol: number; endCol: number };
      cursorLine?: number;
      contextFiles?: string[];
      surroundingCode: { prefix: string; suffix: string };
    }) => ipcRenderer.invoke('inline-chat:generate', params),
    abort: () => ipcRenderer.invoke('inline-chat:abort'),
  },

  completion: {
    inline: (params: {
      prefix: string;
      suffix: string;
      filePath: string;
      language: string;
      recentChanges?: Array<{ filePath: string; oldText: string; newText: string }>;
      maxTokens?: number;
    }) => ipcRenderer.invoke('completion:inline', params),
    abort: () => ipcRenderer.invoke('completion:abort'),
    accept: () => {},
    acceptWord: () => {},
    reject: () => {},
    crossFile: (params: {
      changedFile: string;
      changeDescription: string;
      relatedFiles: Array<{ filePath: string; content: string }>;
    }) => ipcRenderer.invoke('completion:cross-file', params),
  },

  compact: {
    summarize: (messages: Array<{ role: string; content: string }>, language?: string) =>
      ipcRenderer.invoke('compact:summarize', { messages, language }),
  },

  prompt: {
    polish: (text: string) =>
      ipcRenderer.invoke('prompt:polish', { text }),
  },

  quest: {
    getAgentStatus: (taskId: string) =>
      ipcRenderer.invoke('quest:get-agent-status', { taskId }),
    createTask: (params: { scenario: string; runMode: string; autoMode: string; title?: string }) =>
      ipcRenderer.invoke('quest:create-task', params),
    listTasks: () => ipcRenderer.invoke('quest:list-tasks'),
    loadTask: (taskId: string) => ipcRenderer.invoke('quest:load-task', { taskId }),
    deleteTask: (taskId: string) => ipcRenderer.invoke('quest:delete-task', { taskId }),
    renameTask: (taskId: string, title: string) => ipcRenderer.invoke('quest:rename-task', { taskId, title }),
    run: (params: { 
      taskId: string; 
      message: string; 
      scenario: string; 
      runMode: string; 
      autoMode: string;
      runId?: string;
      images?: Array<{ data: string; mediaType: string }>;
      contexts?: Array<{ id: string; type: string; label: string; path: string }>;
    }) =>
      ipcRenderer.invoke('quest:run', params),
    abort: (taskId: string) => ipcRenderer.invoke('quest:abort', { taskId }),
    pause: (taskId: string) => ipcRenderer.invoke('quest:pause', { taskId }),
    resume: (taskId: string, message?: string, runId?: string) =>
      ipcRenderer.invoke('quest:resume', { taskId, message, runId }),
    updateSpec: (taskId: string, content: string) =>
      ipcRenderer.invoke('quest:update-spec', { taskId, content }),
    confirmReply: (requestId: string, approved: boolean, feedback?: string) =>
      ipcRenderer.invoke('quest:confirm:reply', { requestId, approved, feedback }),
    replyAskUser: (requestId: string, answer: string) =>
      ipcRenderer.invoke('quest:ask-user:reply', { requestId, answer }),
    sendIntervention: (taskId: string, text: string) =>
      ipcRenderer.invoke('quest:intervention', { taskId, text }),
    saveMessages: (taskId: string) =>
      ipcRenderer.invoke('quest:save-messages', { taskId }),
    stopOnSwitch: (taskId: string, runId?: string) =>
      ipcRenderer.invoke('quest:stop-on-switch', { taskId, runId }),
    cleanup: (taskId: string) =>
      ipcRenderer.invoke('quest:cleanup', { taskId }),
    revertFile: (filePath: string, beforeContent: string | null) =>
      ipcRenderer.invoke('quest:revert-file', { filePath, beforeContent }),
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('quest:event', handler);
      return () => ipcRenderer.removeListener('quest:event', handler);
    },
    onAskUser: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('quest:ask-user', handler);
      return () => ipcRenderer.removeListener('quest:ask-user', handler);
    },
    onConfirmRequest: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('quest:confirm-request', handler);
      return () => ipcRenderer.removeListener('quest:confirm-request', handler);
    },
    onLog: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('quest:log', handler);
      return () => ipcRenderer.removeListener('quest:log', handler);
    },
  },

  wiki: {
    status: () => ipcRenderer.invoke('wiki:status'),
    generate: () => ipcRenderer.invoke('wiki:generate'),
    detectChanges: () => ipcRenderer.invoke('wiki:detect-changes'),
    update: (params?: { modules?: string[] }) => ipcRenderer.invoke('wiki:update', params),
    checkSync: () => ipcRenderer.invoke('wiki:check-sync'),
    loadToc: () => ipcRenderer.invoke('wiki:load-toc'),
    loadContent: (modulePath: string) => ipcRenderer.invoke('wiki:load-content', { modulePath }),
    abort: () => ipcRenderer.invoke('wiki:abort'),
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('wiki:event', handler);
      return () => ipcRenderer.removeListener('wiki:event', handler);
    },
  },

  browser: {
    initialize: () => ipcRenderer.invoke('browser:initialize'),
    execute: (operation: string, params: Record<string, unknown>) =>
      ipcRenderer.invoke('browser:execute', operation, params),
    shutdown: () => ipcRenderer.invoke('browser:shutdown'),
    getState: () => ipcRenderer.invoke('browser:get-state'),
    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('browser:screenshot', handler);
      return () => ipcRenderer.removeListener('browser:screenshot', handler);
    },
    onStatus: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('browser:status', handler);
      return () => ipcRenderer.removeListener('browser:status', handler);
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('browser:error', handler);
      return () => ipcRenderer.removeListener('browser:error', handler);
    },
  },

  plan: {
    update: (planId: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('plan:update', { planId, updates }),
    approve: (planId: string) =>
      ipcRenderer.invoke('plan:approve', { planId }),
    pause: (planId: string) =>
      ipcRenderer.invoke('plan:pause', { planId }),
    resume: (planId: string) =>
      ipcRenderer.invoke('plan:resume', { planId }),
    cancel: (planId: string) =>
      ipcRenderer.invoke('plan:cancel', { planId }),
    export: (planId: string) =>
      ipcRenderer.invoke('plan:export', { planId }),
    import: (planData: Record<string, unknown>) =>
      ipcRenderer.invoke('plan:import', { planData }),
    delete: (planId: string, workingDirectory: string) =>
      ipcRenderer.invoke('plan:delete', { planId, workingDirectory }),
    load: (planId: string, workingDirectory: string) =>
      ipcRenderer.invoke('plan:load', { planId, workingDirectory }),
    templates: () =>
      ipcRenderer.invoke('plan:templates'),
  },

  ssh: {
    listConnections: () =>
      ipcRenderer.invoke('ssh:list-connections'),
    saveConnection: (form: any) =>
      ipcRenderer.invoke('ssh:save-connection', form),
    deleteConnection: (id: string) =>
      ipcRenderer.invoke('ssh:delete-connection', { id }),
    testConnection: (form: any) =>
      ipcRenderer.invoke('ssh:test-connection', form),
    connect: (connectionId: string) =>
      ipcRenderer.invoke('ssh:connect', { connectionId }),
    disconnect: (sshTerminalId: string) =>
      ipcRenderer.invoke('ssh:disconnect', { sshTerminalId }),
    terminalInput: (sshTerminalId: string, data: string) =>
      ipcRenderer.invoke('ssh:terminal-input', { sshTerminalId, data }),
    terminalResize: (sshTerminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:terminal-resize', { sshTerminalId, cols, rows }),
    onTerminalData: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('ssh:terminal-data', handler);
      return () => ipcRenderer.removeListener('ssh:terminal-data', handler);
    },
    onTerminalClosed: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('ssh:terminal-closed', handler);
      return () => ipcRenderer.removeListener('ssh:terminal-closed', handler);
    },
    // Remote file operations (SFTP)
    readDir: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:read-dir', { sshTerminalId, path }),
    readFile: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:read-file', { sshTerminalId, path }),
    writeFile: (sshTerminalId: string, path: string, content: string) =>
      ipcRenderer.invoke('ssh:write-file', { sshTerminalId, path, content }),
    stat: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:stat', { sshTerminalId, path }),
    mkdir: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:mkdir', { sshTerminalId, path }),
    delete: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:delete', { sshTerminalId, path }),
    rename: (sshTerminalId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('ssh:rename', { sshTerminalId, oldPath, newPath }),
    setWorkspace: (sshTerminalId: string, path: string) =>
      ipcRenderer.invoke('ssh:set-workspace', { sshTerminalId, path }),
    getWorkspace: (sshTerminalId: string) =>
      ipcRenderer.invoke('ssh:get-workspace', { sshTerminalId }),
    exec: (sshTerminalId: string, command: string, cwd?: string) =>
      ipcRenderer.invoke('ssh:exec', { sshTerminalId, command, cwd }),
  },

  context: {
    searchFiles: (query: string, type: 'file' | 'folder') =>
      ipcRenderer.invoke('context:search-files', { query, type }),
    listRules: () => ipcRenderer.invoke('context:list-rules'),
	    createRule: (name: string, content: string) =>
	      ipcRenderer.invoke('context:create-rule', { name, content }),
    parseDocument: (filePath: string) =>
      ipcRenderer.invoke('context:parse-document', { filePath }),
    gitChangedFiles: () => ipcRenderer.invoke('context:git-changed'),
    recentFiles: (limit?: number) =>
      ipcRenderer.invoke('context:recent-files', { limit }),
  },

  // Web Server for mobile access
  webServer: {
    getConfig: () => ipcRenderer.invoke('web-server:get-config'),
    saveConfig: (config: any) => ipcRenderer.invoke('web-server:save-config', config),
    getStatus: () => ipcRenderer.invoke('web-server:get-status'),
    diagnose: () => ipcRenderer.invoke('web-server:diagnose'),
  },

  checkpoint: {
    create: (files: string[], description: string) =>
      ipcRenderer.invoke('checkpoint:create', files, description),
    list: () => ipcRenderer.invoke('checkpoint:list'),
    get: (id: string) => ipcRenderer.invoke('checkpoint:get', id),
    rollback: (checkpointId: string, strategy?: 'force' | 'preserve-manual-edits') =>
      ipcRenderer.invoke('checkpoint:rollback', checkpointId, strategy),
    delete: (id: string) => ipcRenderer.invoke('checkpoint:delete', id),
  },

  // Cloud sync
  cloud: {
    connect: (opts) =>
      ipcRenderer.invoke('cloud:connect', opts),
    disconnect: () => ipcRenderer.invoke('cloud:disconnect'),
    status: () => ipcRenderer.invoke('cloud:status'),
    sessions: {
      list: () => ipcRenderer.invoke('cloud:sessions:list'),
      get: (id) => ipcRenderer.invoke('cloud:sessions:get', id),
      upsert: (session) => ipcRenderer.invoke('cloud:sessions:upsert', session),
      delete: (id) => ipcRenderer.invoke('cloud:sessions:delete', id),
    },
    memories: {
      list: (query) => ipcRenderer.invoke('cloud:memories:list', query),
      upsert: (memory) => ipcRenderer.invoke('cloud:memories:upsert', memory),
      delete: (id) => ipcRenderer.invoke('cloud:memories:delete', id),
    },
    webhook: {
      trigger: (channel, payload) => ipcRenderer.invoke('cloud:webhook:trigger', channel, payload),
      logs: (channel) => ipcRenderer.invoke('cloud:webhook:logs', channel),
    },
    onStatus: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('cloud:status', handler);
      return () => ipcRenderer.removeListener('cloud:status', handler);
    },
    onSyncEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('cloud:sync-event', handler);
      return () => ipcRenderer.removeListener('cloud:sync-event', handler);
    },
    onWebhookEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('cloud:webhook-event', handler);
      return () => ipcRenderer.removeListener('cloud:webhook-event', handler);
    },
    pushSession: (session) =>
      ipcRenderer.invoke('cloud:push-session', session),
    pushMemory: (memory) =>
      ipcRenderer.invoke('cloud:push-memory', memory),
    saveConfig: (config: { url?: string; apiKey?: string }) =>
      ipcRenderer.invoke('cloud:save-config', config),
    getConfig: () =>
      ipcRenderer.invoke('cloud:get-config'),
    api: (opts: { endpoint: string; method?: string; body?: unknown; token?: string; baseUrl?: string }) =>
      ipcRenderer.invoke('cloud:proxy-api', opts),
    setUserToken: (token: string) =>
      ipcRenderer.invoke('cloud:set-user-token', token),
  },

  workflow: {
    start: (requirement: any) =>
      ipcRenderer.invoke('workflow:start', requirement),
    pause: (workflowId: string) =>
      ipcRenderer.invoke('workflow:pause', workflowId),
    resume: (workflowId: string) =>
      ipcRenderer.invoke('workflow:resume', workflowId),
    stop: (workflowId: string) =>
      ipcRenderer.invoke('workflow:stop', workflowId),
    getStatus: (workflowId?: string) =>
      ipcRenderer.invoke('workflow:getStatus', workflowId),
    getHistory: (workflowId: string, limit?: number) =>
      ipcRenderer.invoke('workflow:getHistory', workflowId, limit),
    getDocument: (docType: string, featureName: string) =>
      ipcRenderer.invoke('workflow:getDocument', docType, featureName),
    list: () => ipcRenderer.invoke('workflow:list'),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('workflow:progress', handler);
      return () => ipcRenderer.removeListener('workflow:progress', handler);
    },
    onPhaseChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('workflow:phaseChange', handler);
      return () => ipcRenderer.removeListener('workflow:phaseChange', handler);
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('workflow:error', handler);
      return () => ipcRenderer.removeListener('workflow:error', handler);
    },
    onLog: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('workflow:log', handler);
      return () => ipcRenderer.removeListener('workflow:log', handler);
    },
  },

  connector: {
    register: (type: string, config: any) =>
      ipcRenderer.invoke('connector:register', type, config),
    unregister: (connectorId: string) =>
      ipcRenderer.invoke('connector:unregister', connectorId),
    configure: (connectorId: string, config: any) =>
      ipcRenderer.invoke('connector:configure', connectorId, config),
    test: (connectorId: string) =>
      ipcRenderer.invoke('connector:test', connectorId),
    getStatus: (connectorId: string) =>
      ipcRenderer.invoke('connector:getStatus', connectorId),
    list: () => ipcRenderer.invoke('connector:list'),
    getConfig: (connectorId: string) =>
      ipcRenderer.invoke('connector:getConfig', connectorId),
    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('connector:statusChange', handler);
      return () => ipcRenderer.removeListener('connector:statusChange', handler);
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('connector:error', handler);
      return () => ipcRenderer.removeListener('connector:error', handler);
    },
  },

  trigger: {
    create: (type: string, config: any) =>
      ipcRenderer.invoke('trigger:create', type, config),
    update: (triggerId: string, config: any) =>
      ipcRenderer.invoke('trigger:update', triggerId, config),
    delete: (triggerId: string) =>
      ipcRenderer.invoke('trigger:delete', triggerId),
    enable: (triggerId: string) =>
      ipcRenderer.invoke('trigger:enable', triggerId),
    disable: (triggerId: string) =>
      ipcRenderer.invoke('trigger:disable', triggerId),
    getStatus: (triggerId: string) =>
      ipcRenderer.invoke('trigger:getStatus', triggerId),
    list: () => ipcRenderer.invoke('trigger:list'),
    getConfig: (triggerId: string) =>
      ipcRenderer.invoke('trigger:getConfig', triggerId),
    onFired: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('trigger:fired', handler);
      return () => ipcRenderer.removeListener('trigger:fired', handler);
    },
    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('trigger:statusChange', handler);
      return () => ipcRenderer.removeListener('trigger:statusChange', handler);
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('trigger:error', handler);
      return () => ipcRenderer.removeListener('trigger:error', handler);
    },
  },

  batch: {
    submit: (tasks: any[]) =>
      ipcRenderer.invoke('batch:submit', tasks),
    cancel: (taskId: string) =>
      ipcRenderer.invoke('batch:cancel', taskId),
    getProgress: (taskId: string) =>
      ipcRenderer.invoke('batch:getProgress', taskId),
    getResult: (taskId: string) =>
      ipcRenderer.invoke('batch:getResult', taskId),
    list: (status?: string) =>
      ipcRenderer.invoke('batch:list', status),
    getTask: (taskId: string) =>
      ipcRenderer.invoke('batch:getTask', taskId),
    pause: (taskId: string) =>
      ipcRenderer.invoke('batch:pause', taskId),
    resume: (taskId: string) =>
      ipcRenderer.invoke('batch:resume', taskId),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('batch:progress', handler);
      return () => ipcRenderer.removeListener('batch:progress', handler);
    },
    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('batch:complete', handler);
      return () => ipcRenderer.removeListener('batch:complete', handler);
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('batch:error', handler);
      return () => ipcRenderer.removeListener('batch:error', handler);
    },
    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('batch:statusChange', handler);
      return () => ipcRenderer.removeListener('batch:statusChange', handler);
    },
  },


  cloudManagement: {
    user: {
      getInfo: () => ipcRenderer.invoke('cloud:user:getInfo'),
      update: (params: any) => ipcRenderer.invoke('cloud:user:update', params),
      changePassword: (params: any) => ipcRenderer.invoke('cloud:user:changePassword', params),
      getSecuritySettings: () => ipcRenderer.invoke('cloud:user:getSecuritySettings'),
      updateSecuritySettings: (settings: any) => ipcRenderer.invoke('cloud:user:updateSecuritySettings', settings),
      enableTwoFactor: (params: any) => ipcRenderer.invoke('cloud:user:enableTwoFactor', params),
      disableTwoFactor: (code: string) => ipcRenderer.invoke('cloud:user:disableTwoFactor', code),
      verifyTwoFactor: (code: string) => ipcRenderer.invoke('cloud:user:verifyTwoFactor', code),
      getLoginHistory: (limit?: number, offset?: number) => ipcRenderer.invoke('cloud:user:getLoginHistory', limit, offset),
      logoutAllDevices: () => ipcRenderer.invoke('cloud:user:logoutAllDevices'),
      deleteAccount: (password: string) => ipcRenderer.invoke('cloud:user:deleteAccount', password),
      updateAvatar: (avatarData: string) => ipcRenderer.invoke('cloud:user:updateAvatar', avatarData),
    },
    device: {
      getAll: () => ipcRenderer.invoke('cloud:device:getAll'),
      get: (deviceId: string) => ipcRenderer.invoke('cloud:device:get', deviceId),
      register: (params: any) => ipcRenderer.invoke('cloud:device:register', params),
      updateName: (deviceId: string, name: string) => ipcRenderer.invoke('cloud:device:updateName', deviceId, name),
      revoke: (deviceId: string) => ipcRenderer.invoke('cloud:device:revoke', deviceId),
      delete: (deviceId: string) => ipcRenderer.invoke('cloud:device:delete', deviceId),
      generateAuthCode: () => ipcRenderer.invoke('cloud:device:generateAuthCode'),
      authorize: (code: string) => ipcRenderer.invoke('cloud:device:authorize', code),
      getCurrent: () => ipcRenderer.invoke('cloud:device:getCurrent'),
      getOnline: () => ipcRenderer.invoke('cloud:device:getOnline'),
    },
    subscription: {
      get: () => ipcRenderer.invoke('cloud:subscription:get'),
      getPlans: () => ipcRenderer.invoke('cloud:subscription:getPlans'),
      getPlan: (planId: string) => ipcRenderer.invoke('cloud:subscription:getPlan', planId),
      subscribe: (params: any) => ipcRenderer.invoke('cloud:subscription:subscribe', params),
      upgrade: (planId: string) => ipcRenderer.invoke('cloud:subscription:upgrade', planId),
      downgrade: (planId: string) => ipcRenderer.invoke('cloud:subscription:downgrade', planId),
      cancel: (reason?: string) => ipcRenderer.invoke('cloud:subscription:cancel', reason),
      renew: () => ipcRenderer.invoke('cloud:subscription:renew'),
      enableAutoRenew: () => ipcRenderer.invoke('cloud:subscription:enableAutoRenew'),
      disableAutoRenew: () => ipcRenderer.invoke('cloud:subscription:disableAutoRenew'),
      getUsage: () => ipcRenderer.invoke('cloud:subscription:getUsage'),
      comparePlans: () => ipcRenderer.invoke('cloud:subscription:comparePlans'),
      getPayments: () => ipcRenderer.invoke('cloud:subscription:getPayments'),
      submitOfflinePayment: (params: any) => ipcRenderer.invoke('cloud:subscription:submitOfflinePayment', params),
      getInvoices: () => ipcRenderer.invoke('cloud:subscription:getInvoices'),
      createInvoice: (params: any) => ipcRenderer.invoke('cloud:subscription:createInvoice', params),
    },
    sync: {
      getStatus: () => ipcRenderer.invoke('cloud:sync:getStatus'),
      now: (params?: any) => ipcRenderer.invoke('cloud:sync:now', params),
      pause: () => ipcRenderer.invoke('cloud:sync:pause'),
      resume: () => ipcRenderer.invoke('cloud:sync:resume'),
      getHistory: (limit?: number, offset?: number) => ipcRenderer.invoke('cloud:sync:getHistory', limit, offset),
      getConflicts: () => ipcRenderer.invoke('cloud:sync:getConflicts'),
      resolveConflict: (params: any) => ipcRenderer.invoke('cloud:sync:resolveConflict', params),
      resolveAllConflicts: (resolution: string) => ipcRenderer.invoke('cloud:sync:resolveAllConflicts', resolution),
      getSettings: () => ipcRenderer.invoke('cloud:sync:getSettings'),
      updateSettings: (settings: any) => ipcRenderer.invoke('cloud:sync:updateSettings', settings),
      getPendingChanges: () => ipcRenderer.invoke('cloud:sync:getPendingChanges'),
    },
    storage: {
      getStats: () => ipcRenderer.invoke('cloud:storage:getStats'),
      getFiles: (params?: any) => ipcRenderer.invoke('cloud:storage:getFiles', params),
      getFile: (fileId: string) => ipcRenderer.invoke('cloud:storage:getFile', fileId),
      deleteFile: (fileId: string) => ipcRenderer.invoke('cloud:storage:deleteFile', fileId),
      deleteFiles: (fileIds: string[]) => ipcRenderer.invoke('cloud:storage:deleteFiles', fileIds),
      downloadFile: (fileId: string) => ipcRenderer.invoke('cloud:storage:downloadFile', fileId),
      getCleanupSuggestions: () => ipcRenderer.invoke('cloud:storage:getCleanupSuggestions'),
      performCleanup: (params: any) => ipcRenderer.invoke('cloud:storage:performCleanup', params),
      exportData: (dataTypes: string[]) => ipcRenderer.invoke('cloud:storage:exportData', dataTypes),
      importData: (file: File) => ipcRenderer.invoke('cloud:storage:importData', file),
      getCategoryStats: () => ipcRenderer.invoke('cloud:storage:getCategoryStats'),
    },
    apiKey: {
      getAll: (params?: any) => ipcRenderer.invoke('cloud:apiKey:getAll', params),
      get: (keyId: string) => ipcRenderer.invoke('cloud:apiKey:get', keyId),
      create: (params: any) => ipcRenderer.invoke('cloud:apiKey:create', params),
      update: (keyId: string, params: any) => ipcRenderer.invoke('cloud:apiKey:update', keyId, params),
      delete: (keyId: string) => ipcRenderer.invoke('cloud:apiKey:delete', keyId),
      regenerate: (keyId: string) => ipcRenderer.invoke('cloud:apiKey:regenerate', keyId),
      toggleStatus: (keyId: string) => ipcRenderer.invoke('cloud:apiKey:toggleStatus', keyId),
      getStats: () => ipcRenderer.invoke('cloud:apiKey:getStats'),
      getUsageHistory: (keyId: string, params?: any) => ipcRenderer.invoke('cloud:apiKey:getUsageHistory', keyId, params),
      test: (keyId: string) => ipcRenderer.invoke('cloud:apiKey:test', keyId),
      getPermissions: () => ipcRenderer.invoke('cloud:apiKey:getPermissions'),
    },
  },

  subscription: {
    status: (token: string) => ipcRenderer.invoke('subscription:status', { token }),
    plans: () => ipcRenderer.invoke('subscription:plans'),
    create: (params: { token: string; planId: string; billingCycle?: string }) => ipcRenderer.invoke('subscription:create', params),
    cancel: (token: string) => ipcRenderer.invoke('subscription:cancel', { token }),
    payments: (token: string) => ipcRenderer.invoke('subscription:payments', { token }),
    offlinePayment: (params: { token: string; amount: number; companyName: string; bankName?: string; bankAccount?: string; remark?: string; receiptUrl?: string }) => ipcRenderer.invoke('subscription:offline-payment', params),
  },



  // 应用控制 API
  appControl: {
    getInstalledApps: () => ipcRenderer.invoke('app-control:get-installed-apps'),
    getWindows: () => ipcRenderer.invoke('app-control:get-windows'),
    launchApp: (appName: string, args?: string[]) => ipcRenderer.invoke('app-control:launch-app', appName, args),
    closeApp: (appName: string) => ipcRenderer.invoke('app-control:close-app', appName),
    focusWindow: (title: string) => ipcRenderer.invoke('app-control:focus-window', title),
  },

  // 邮件服务 API
  emailService: {
    initSmtp: (config: any) => ipcRenderer.invoke('email:init-smtp', config),
    getConfig: () => ipcRenderer.invoke('email:get-config'),
    validateConfig: (config: any) => ipcRenderer.invoke('email:validate-config', config),
    getPresetList: () => ipcRenderer.invoke('email:get-presets'),
    sendMail: (mailConfig: any) => ipcRenderer.invoke('email:send', mailConfig),
    sendWithPreset: (presetKey: string, replacements: Record<string, string>, mailConfig: any) =>
      ipcRenderer.invoke('email:send-with-preset', presetKey, replacements, mailConfig),
  },

  // 桌面操控权限 API
  desktopControl: {
    hasPassword: () => ipcRenderer.invoke('desktop-control:has-password'),
    setPassword: (password: string) => ipcRenderer.invoke('desktop-control:set-password', { password }),
    verifyPassword: (password: string) => ipcRenderer.invoke('desktop-control:verify-password', { password }),
    isEnabled: () => ipcRenderer.invoke('desktop-control:is-enabled'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('desktop-control:set-enabled', { enabled }),
    // 鼠标操作
    mouse: {
      getPosition: () => ipcRenderer.invoke('desktop-control:mouse-position'),
      move: (x: number, y: number) => ipcRenderer.invoke('desktop-control:mouse-move', { x, y }),
      moveSmooth: (x: number, y: number, speed?: number) => ipcRenderer.invoke('desktop-control:mouse-move-smooth', { x, y, speed }),
      click: (button?: string, double?: boolean) => ipcRenderer.invoke('desktop-control:mouse-click', { button, double }),
      toggle: (down?: string, button?: string) => ipcRenderer.invoke('desktop-control:mouse-toggle', { down, button }),
      drag: (x: number, y: number) => ipcRenderer.invoke('desktop-control:mouse-drag', { x, y }),
      scroll: (x: number, y: number) => ipcRenderer.invoke('desktop-control:mouse-scroll', { x, y }),
    },
    // 键盘操作
    keyboard: {
      type: (text: string) => ipcRenderer.invoke('desktop-control:keyboard-type', { text }),
      typeDelayed: (text: string, cpm: number) => ipcRenderer.invoke('desktop-control:keyboard-type-delayed', { text, cpm }),
      tap: (key: string, modifiers?: string | string[]) => ipcRenderer.invoke('desktop-control:keyboard-tap', { key, modifiers }),
      toggle: (key: string, down: string, modifiers?: string | string[]) => ipcRenderer.invoke('desktop-control:keyboard-toggle', { key, down, modifiers }),
    },
    // 屏幕操作
    screen: {
      getSize: () => ipcRenderer.invoke('desktop-control:screen-size'),
      capture: (x?: number, y?: number, width?: number, height?: number) =>
        ipcRenderer.invoke('desktop-control:screen-capture', { x, y, width, height }),
      pixelColor: (x: number, y: number) => ipcRenderer.invoke('desktop-control:pixel-color', { x, y }),
    },
    // 延迟设置
    setMouseDelay: (delay: number) => ipcRenderer.invoke('desktop-control:set-mouse-delay', { delay }),
    setKeyboardDelay: (delay: number) => ipcRenderer.invoke('desktop-control:set-keyboard-delay', { delay }),
  },

  // 系统控制 API（硬件监控 + 音量/亮度）
  systemControl: {
    monitor: {
      info: () => ipcRenderer.invoke('system:info'),
      cpuLoad: () => ipcRenderer.invoke('system:cpu-load'),
      memory: () => ipcRenderer.invoke('system:memory'),
      battery: () => ipcRenderer.invoke('system:battery'),
      temperature: () => ipcRenderer.invoke('system:temperature'),
      disks: () => ipcRenderer.invoke('system:disks'),
      processes: () => ipcRenderer.invoke('system:processes'),
    },
    volume: {
      get: () => ipcRenderer.invoke('system:volume-get'),
      set: (volume: number) => ipcRenderer.invoke('system:volume-set', { volume }),
      mute: () => ipcRenderer.invoke('system:volume-mute'),
    },
    brightness: {
      get: () => ipcRenderer.invoke('system:brightness-get'),
      set: (brightness: number) => ipcRenderer.invoke('system:brightness-set', { brightness }),
    },
  },

  // 设备权限管理 API（摄像头 / 麦克风）
  permissions: {
    camera: {
      isEnabled: () => ipcRenderer.invoke('permission:camera:is-enabled'),
      setEnabled: (enabled: boolean) => ipcRenderer.invoke('permission:camera:set-enabled', { enabled }),
      getStatus: () => ipcRenderer.invoke('permission:camera:get-status'),

      // 拍照：使用浏览器 getUserMedia + canvas 截图，返回 base64 JPEG
      capturePhoto: async (): Promise<{ success: boolean; data?: string; error?: string }> => {
        try {
          // 1. 检查摄像头权限
          const isEnabled = await ipcRenderer.invoke('permission:camera:is-enabled');
          if (!isEnabled) {
            return { success: false, error: '摄像头权限未开启，请在 设置→高级→摄像头权限 中开启' };
          }

          // 2. 获取摄像头流
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });

          // 3. 用 video 元素播放一帧
          const video = document.createElement('video');
          video.srcObject = stream;
          video.setAttribute('playsinline', '');
          video.setAttribute('autoplay', '');

          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => {
              video.play().then(resolve).catch(reject);
            };
            video.onerror = () => reject(new Error('视频流加载失败'));
            // 超时 5 秒
            setTimeout(() => reject(new Error('摄像头启动超时')), 5000);
          });

          // 等待足够帧以确保画面稳定
          await new Promise(r => setTimeout(r, 500));

          // 4. 绘制到 canvas 并导出 base64
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            stream.getTracks().forEach(t => t.stop());
            return { success: false, error: '无法创建 canvas 上下文' };
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const base64 = canvas.toDataURL('image/jpeg', 0.85);

          // 5. 清理
          stream.getTracks().forEach(t => t.stop());
          video.remove();
          canvas.remove();

          return { success: true, data: base64 };
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes('NotAllowed') || msg.includes('Permission')) {
            return { success: false, error: '摄像头访问被拒绝，请检查系统权限设置' };
          }
          if (msg.includes('NotFound') || msg.includes('Devices')) {
            return { success: false, error: '未检测到摄像头设备' };
          }
          return { success: false, error: msg || '拍照失败' };
        }
      },
    },
    microphone: {
      isEnabled: () => ipcRenderer.invoke('permission:microphone:is-enabled'),
      setEnabled: (enabled: boolean) => ipcRenderer.invoke('permission:microphone:set-enabled', { enabled }),
      getStatus: () => ipcRenderer.invoke('permission:microphone:get-status'),

      // 录音：使用浏览器 MediaRecorder API，返回 base64 WAV/WebM
      startRecording: async (): Promise<{ success: boolean; error?: string }> => {
        try {
          const isEnabled = await ipcRenderer.invoke('permission:microphone:is-enabled');
          if (!isEnabled) return { success: false, error: '麦克风权限未开启，请在 设置→高级→麦克风权限 中开启' };

          // 清理上一次录音
          if ((window as any).__micStream) {
            (window as any).__micStream.getTracks().forEach((t: any) => t.stop());
          }
          if ((window as any).__micRecorder && (window as any).__micRecorder.state !== 'inactive') {
            (window as any).__micRecorder.stop();
          }
          (window as any).__micChunks = [];

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          (window as any).__micStream = stream;

          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
          (window as any).__micRecorder = recorder;

          return new Promise((resolve) => {
            recorder.ondataavailable = (e: BlobEvent) => {
              if (e.data.size > 0) (window as any).__micChunks.push(e.data);
            };
            recorder.onerror = () => {
              stream.getTracks().forEach((t) => t.stop());
              resolve({ success: false, error: '录音启动失败' });
            };
            recorder.onstart = () => {
              resolve({ success: true });
            };
            recorder.start(1000); // 每秒收集一个 chunk
          });
        } catch (err: any) {
          if (err.name === 'NotAllowedError') return { success: false, error: '麦克风访问被拒绝，请检查系统权限设置' };
          if (err.name === 'NotFoundError') return { success: false, error: '未检测到麦克风设备' };
          return { success: false, error: err.message || '录音启动失败' };
        }
      },

      // 停止录音并返回 base64
      stopRecording: async (): Promise<{ success: boolean; data?: string; duration?: number; error?: string }> => {
        try {
          const recorder = (window as any).__micRecorder;
          const stream = (window as any).__micStream;
          if (!recorder) return { success: false, error: '没有正在进行的录音' };

          return new Promise((resolve) => {
            recorder.onstop = async () => {
              stream.getTracks().forEach((t: any) => t.stop());
              (window as any).__micStream = null;
              (window as any).__micRecorder = null;

              const chunks = (window as any).__micChunks || [];
              if (chunks.length === 0) {
                resolve({ success: false, error: '录音数据为空' });
                return;
              }
              const blob = new Blob(chunks, { type: 'audio/webm' });
              (window as any).__micChunks = [];

              // 计算时长（近似）
              const duration = chunks.length; // 每秒一个chunk
              const base64 = await new Promise<string>((r) => {
                const reader = new FileReader();
                reader.onloadend = () => r((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
              });
              resolve({ success: true, data: base64, duration });
            };
            recorder.stop();
          });
        } catch (err: any) {
          return { success: false, error: err.message || '停止录音失败' };
        }
      },
    },
  },

  // 音频设备管理 API（扬声器/麦克风设备枚举）
  audio: {
    enumerateDevices: () => ipcRenderer.invoke('audio:enumerate-devices'),
    getActiveDevice: () => ipcRenderer.invoke('audio:get-active-device'),
    setOutputDevice: (deviceId: string) => ipcRenderer.invoke('audio:set-output-device', { deviceId }),
    checkMicAvailable: () => ipcRenderer.invoke('audio:check-mic-available'),
  },

});
