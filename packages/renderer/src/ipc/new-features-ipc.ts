export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  try {
    const result = await window.electronAPI?.invoke?.(channel, ...args);
    return { success: true, data: result as T };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export const checkpointIpc = {
  create: (files: string[], description: string) => invoke<unknown>('checkpoint:create', files, description),
  list: () => invoke<unknown[]>('checkpoint:list'),
  get: (id: string) => invoke<unknown>('checkpoint:get', id),
  rollback: (id: string, strategy?: string) => invoke<unknown>('checkpoint:rollback', id, strategy),
  delete: (id: string) => invoke<boolean>('checkpoint:delete', id),
};

export const contextIpc = {
  autoCollect: (projectRoot: string, openFiles: string[], recentEdits: string[]) => invoke<void>('context:autoCollect', projectRoot, openFiles, recentEdits),
  addFile: (path: string, content: string, priority: string) => invoke<void>('context:addFile', path, content, priority),
  removeFile: (path: string) => invoke<void>('context:removeFile', path),
  getUsage: () => invoke<unknown>('context:getUsage'),
  compact: () => invoke<void>('context:compact'),
};

export const intentIpc = {
  getState: () => invoke<unknown>('intent:getState'),
};

export const completionIpc = {
  trigger: (params: unknown) => invoke<void>('completion:trigger', params),
  cancel: () => invoke<void>('completion:cancel'),
  accept: () => invoke<string>('completion:accept'),
  acceptWord: () => invoke<unknown>('completion:acceptWord'),
  reject: () => invoke<void>('completion:reject'),
};

export const terminalSuggestIpc = {
  analyze: (intent: string, projectRoot: string) => invoke<unknown[]>('terminalSuggest:analyze', intent, projectRoot),
};

export const autoFixIpc = {
  suggest: (diagnostic: unknown) => invoke<unknown>('autoFix:suggest', diagnostic),
  apply: (fixId: string) => invoke<unknown>('autoFix:apply', fixId),
  batchSuggest: (diagnostics: unknown[]) => invoke<unknown[]>('autoFix:batchSuggest', diagnostics),
};

export const ruleIpc = {
  reload: () => invoke<void>('rule:reload'),
  getMerged: () => invoke<unknown>('rule:getMerged'),
  getConflicts: () => invoke<unknown[]>('rule:getConflicts'),
};

export const agentModeIpc = {
  previewPlan: (instruction: string, steps: unknown[]) => invoke<unknown>('agentMode:previewPlan', instruction, steps),
  executePlan: (planId: string) => invoke<unknown>('agentMode:executePlan', planId),
  confirmStep: (stepId: string) => invoke<void>('agentMode:confirmStep', stepId),
  interrupt: () => invoke<void>('agentMode:interrupt'),
};

export const multiFileEditIpc = {
  generate: (instruction: string, contextFiles: string[]) => invoke<unknown>('multiFileEdit:generate', instruction, contextFiles),
  acceptFile: (filePath: string) => invoke<void>('multiFileEdit:acceptFile', filePath),
  rejectFile: (filePath: string) => invoke<void>('multiFileEdit:rejectFile', filePath),
  acceptBlock: (filePath: string, hunkId: string) => invoke<void>('multiFileEdit:acceptBlock', filePath, hunkId),
  rejectBlock: (filePath: string, hunkId: string) => invoke<void>('multiFileEdit:rejectBlock', filePath, hunkId),
  applyAll: () => invoke<unknown[]>('multiFileEdit:applyAll'),
};
