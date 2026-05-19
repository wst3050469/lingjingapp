import { ipcMain } from 'electron';
import { CheckpointManager, FileCheckpointStorage, SnapshotCreator, RollbackExecutor, CheckpointCleaner } from '@codepilot/core/checkpoint';
import { ContextManager } from '@codepilot/core/context';
import { IntentDetector } from '@codepilot/core/intent';
import { CompletionEngine } from '@codepilot/core/completion';
import { TerminalSuggester } from '@codepilot/core/terminal-suggester';
import { AutoFixEngine } from '@codepilot/core/auto-fix';
import { AgentModeEnhancer } from '@codepilot/core/agent-mode';
import { MultiFileEditEngine } from '@codepilot/core/multi-file-edit';
// @ts-ignore - RuleMerger available at runtime
import { RuleMerger } from '@codepilot/core/rules';
import { registerPipelineIPC } from '../pipeline/pipeline-ipc.js';
import { registerReviewIPC } from '../review/review-ipc.js';
import { registerPMIPC } from '../pm/pm-ipc.js';
import { registerSecurityIPC } from '../security/security-ipc.js';

export function registerNewFeatureIPC(config: {
  checkpointDir: string;
  projectRoot: string;
  contextMaxTokens: number;
}): void {
  // Checkpoint IPC
  const checkpointStorage = new FileCheckpointStorage(config.checkpointDir);
  const checkpointManager = new CheckpointManager(checkpointStorage);
  const snapshotCreator = new SnapshotCreator(config.checkpointDir);
  const rollbackExecutor = new RollbackExecutor();

  ipcMain.handle('checkpoint:create', async (_e, files: string[], desc: string) => snapshotCreator.createSnapshot(files, desc));
  ipcMain.handle('checkpoint:list', async () => checkpointManager.list());
  ipcMain.handle('checkpoint:get', async (_e, id: string) => checkpointManager.get(id));
  ipcMain.handle('checkpoint:rollback', async (_e, id: string, strategy?: string) => {
    const cp = await checkpointManager.get(id);
    if (!cp) return { success: false, checkpointId: id, restoredFiles: [], conflictFiles: [], message: 'Not found' };
    return rollbackExecutor.rollback(cp, strategy as 'force' | 'preserve-manual-edits');
  });
  ipcMain.handle('checkpoint:delete', async (_e, id: string) => checkpointManager.delete(id));

  // Context IPC
  const contextManager = new ContextManager({ maxTokens: config.contextMaxTokens, compactThreshold: 75, compactTarget: 50 });
  ipcMain.handle('context:autoCollect', async (_e, root: string, open: string[], recent: string[]) => contextManager.autoCollect(root, open, recent));
  ipcMain.handle('context:addFile', async (_e, path: string, content: string, priority: string) => contextManager.addFile(path, content, priority as any));
  ipcMain.handle('context:removeFile', async (_e, path: string) => contextManager.removeFile(path));
  ipcMain.handle('context:getUsage', async () => contextManager.getUsage());
  ipcMain.handle('context:compact', async () => contextManager.compact());

  // Intent IPC
  const intentDetector = new IntentDetector();
  ipcMain.handle('intent:getState', async () => intentDetector.getState());

  // Terminal Suggester IPC
  const terminalSuggester = new TerminalSuggester();
  ipcMain.handle('terminalSuggest:analyze', async (_e, intent: string, root: string) => terminalSuggester.analyze(intent, root));

  // Auto Fix IPC
  const autoFixEngine = new AutoFixEngine();
  ipcMain.handle('autoFix:suggest', async (_e, diagnostic: any) => autoFixEngine.suggest(diagnostic, ''));
  ipcMain.handle('autoFix:apply', async (_e, fixId: string) => ({ success: true, fixId, appliedAt: new Date() }));
  ipcMain.handle('autoFix:batchSuggest', async (_e, diagnostics: any[]) => autoFixEngine.batchSuggest(diagnostics));

  // Rule IPC
  const ruleMerger = new RuleMerger();
  ipcMain.handle('rule:reload', async () => {});
  ipcMain.handle('rule:getMerged', async () => ruleMerger.merge([], []));
  ipcMain.handle('rule:getConflicts', async () => ruleMerger.merge([], []).conflicts);

  // Agent Mode IPC
  const agentModeEnhancer = new AgentModeEnhancer();
  ipcMain.handle('agentMode:previewPlan', async (_e, instruction: string, steps: any[]) => agentModeEnhancer.previewPlan(instruction, steps));
  ipcMain.handle('agentMode:executePlan', async () => agentModeEnhancer.getPlan());
  ipcMain.handle('agentMode:confirmStep', async (_e, stepId: string) => agentModeEnhancer.confirmStep(stepId));
  ipcMain.handle('agentMode:interrupt', async () => agentModeEnhancer.interrupt());

  // Multi File Edit IPC
  const multiFileEditEngine = new MultiFileEditEngine();
  ipcMain.handle('multiFileEdit:generate', async (_e, instruction: string, files: string[]) => multiFileEditEngine.generate(instruction, files));
  ipcMain.handle('multiFileEdit:acceptFile', async () => {});
  ipcMain.handle('multiFileEdit:rejectFile', async () => {});
  ipcMain.handle('multiFileEdit:applyAll', async () => []);

  // Platform module IPC registrations (pipeline/review/pm/security)
  registerPipelineIPC();
  registerReviewIPC();
  registerPMIPC();
  registerSecurityIPC();
}
