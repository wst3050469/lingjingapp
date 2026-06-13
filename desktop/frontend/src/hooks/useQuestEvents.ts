// Quest Mode event subscription hook
// Mirrors useAgentEvents.ts but listens on quest:* channels
// Dispatches to quest-store and quest-diff-store

import { useEffect } from 'react';
import { useQuestStore, generateQuestMessageId } from '../stores/quest-store';
import { useQuestDiffStore } from '../stores/quest-diff-store';
import { useTodoStore } from '../stores/todo-store';

export function useQuestEvents(): void {
  useEffect(() => {
    // Load config for context meter + auto-compact + file change behavior
    let fileChangeBehavior: string = 'auto-accept';
    window.electronAPI.config.get().then((cfg: any) => {
      if (cfg?.maxContextTokens) {
        useQuestStore.getState().setMaxContextTokens(cfg.maxContextTokens);
      }
      fileChangeBehavior = cfg?.quest?.fileChangeBehavior ?? 'auto-accept';
    }).catch(() => { /* ignore */ });

    // Listen for config changes
    const onBehaviorChange = (e: CustomEvent) => {
      if (e.detail?.behavior) fileChangeBehavior = e.detail.behavior;
    };
    window.addEventListener('quest:file-behavior-changed', onBehaviorChange as EventListener);

    const unsubEvent = window.electronAPI.quest.onEvent((event: any) => {
      const store = useQuestStore.getState();

      // Filter events by activeTaskId to prevent stale-agent pollution
      // Skip filter for cross-task events that update task metadata
      const crossTaskEvents = ['status_change', 'title_change', 'todo_update', 'file_snapshot'];
      const isCrossTask = crossTaskEvents.includes(event.type);
      if (!isCrossTask && event.taskId && event.taskId !== store.activeTaskId) {
        return; // Ignore events from other/old tasks
      }

      // runId epoch filter: discard stale streaming events from old runs.
      // Cross-task events (todo_update, file_snapshot, etc.) are exempt from this filter
      // because they carry task metadata that must be applied regardless of run epoch.
      // IMPORTANT: 'done', 'error', and 'status_change' are lifecycle events that MUST be
      // processed even with mismatched runId — they clean up activeRunId, runningTaskIds,
      // and task status. Without this, error events from Agent (which carry their runId)
      // are dropped when activeRunId changes, leaving error messages never shown and
      // state never cleaned up.
      //
      // BUT: we must protect against LATE lifecycle events from a PREVIOUS agent run
      // (e.g. stopOnSwitch's 'done' event arriving after the new resume run has started).
      // The age guard: if activeRunId is set and differs from event.runId, only process
      // the lifecycle event if it would NOT reset activeRunId or isStreaming.
      const isLifecycleEvent = event.type === 'done' || event.type === 'error' || event.type === 'status_change';
      if (!isCrossTask && !isLifecycleEvent && event.runId) {
        if (!store.activeRunId || event.runId !== store.activeRunId) {
          return; // Stale streaming event from a previous run – drop it
        }
      }

      // Late lifecycle event guard: if activeRunId is set and differs, this is a stale
      // lifecycle event from a previous run. We still need to update task status/properties,
      // but we MUST NOT reset streaming state or activeRunId.
      const isLateLifecycleEvent = isLifecycleEvent && event.runId && store.activeRunId && event.runId !== store.activeRunId;

      switch (event.type) {
        case 'thinking':
          store.flushStreamText();
          break;

        case 'text':
          store.appendStreamText(event.text);
          break;

        case 'tool_start': {
          store.flushStreamText();
          store.addMessage({
            id: generateQuestMessageId(),
            role: 'tool',
            content: `Running tool: ${event.name}`,
            toolCalls: [{ name: event.name, args: event.args || {} }],
            timestamp: Date.now(),
          });
          break;
        }

        case 'tool_progress':
          if (event.name && event.text) {
            store.appendToolProgress(event.name, event.text);
          }
          break;

        case 'tool_end':
          if (event.name && event.result) {
            store.updateToolResult(event.name, event.result);
          }
          break;

        case 'usage':
          store.updateCumulativeTokens();
          break;

        case 'error':
          store.addMessage({
            id: generateQuestMessageId(),
            role: 'assistant',
            content: `Error: ${event.error?.message || 'Unknown error'}`,
            timestamp: Date.now(),
          });
          // Only reset streaming state if this is NOT a late lifecycle event
          // (late event = old run's done/error arriving after new run started)
          if (!isLateLifecycleEvent) {
            store.setStreaming(false);
            store.setActiveRunId(null);
            if (event.taskId) {
              store.removeRunningTask(event.taskId);
            }
          }
          break;

        case 'done': {
          const streamText = useQuestStore.getState().currentStreamText;
          if (streamText) {
            store.addMessage({
              id: generateQuestMessageId(),
              role: 'assistant',
              content: streamText,
              timestamp: Date.now(),
            });
          }
          store.resetStreamText();
          // Only reset streaming state and remove from running tasks if this
          // is NOT a late lifecycle event (old run's done arriving after new
          // run started). Prevents stopOnSwitch's done event from killing
          // the new resume run.
          if (!isLateLifecycleEvent) {
            store.setStreaming(false);
            store.setActiveRunId(null);
            if (event.taskId) {
              store.removeRunningTask(event.taskId);
            }
          }

          // Auto-compact: check if conversation needs compaction after each response
          try {
            useQuestStore.getState().autoCompactIfNeeded();
          } catch { /* non-critical */ }
          break;
        }

        // Quest-specific: spec generated
        case 'spec_generated':
          if (event.specContent) {
            store.setSpecContent(event.specContent);
            store.setSpecStatus('pending');
            store.setActiveArtifactTab('spec');
            // Sync the tasks array so task.specContent stays in sync with the store-level specContent.
            // Without this, switching away and back to the task would read stale null from the tasks array.
            if (event.taskId) {
              store.updateTaskSpec(event.taskId, event.specContent);
            }
          }
          break;

        // Quest-specific: preview URL auto-detected from AI output
        case 'preview_url':
          if (event.url) {
            store.setPreviewUrl(event.url);
          }
          break;

        // Quest-specific: task title auto-updated
        case 'title_change':
          if (event.taskId && event.title) {
            store.updateTaskTitle(event.taskId, event.title);
          }
          break;

        // Quest-specific: task status change
        case 'status_change':
          if (event.taskId && event.status) {
            // ★ CRITICAL: Late lifecycle events (e.g. stopOnSwitch's 'paused'
            // arriving AFTER a new resume run has started) must NOT overwrite
            // the task status or remove the task from runningTaskIds.
            // Without this guard, the old 'paused' event from stopOnSwitch
            // corrupts the newly-running task's status back to 'paused'.
            if (!isLateLifecycleEvent) {
              store.setTaskStatus(event.taskId, event.status);
            }
            if (event.status === 'running') {
              store.addRunningTask(event.taskId);
              // Ensure streaming flag is set when agent starts running
              if (event.taskId === store.activeTaskId) {
                store.setStreaming(true);
              }
            } else if (!isLateLifecycleEvent) {
              // Only remove from runningTaskIds and reset streaming for
              // non-stale status_change events.
              store.removeRunningTask(event.taskId);
              if (event.taskId === store.activeTaskId) {
                store.resetStreamText();
                store.setStreaming(false);
              }
            }
          }
          break;

        // ★ Agent stalled: model stopped calling tools after max retries.
        // Show a visible system message so the user knows to intervene.
        case 'stalled':
          store.addMessage({
            id: generateQuestMessageId(),
            role: 'system',
            content: `⚠️ ${event.message || 'Agent 已停止自动执行，请提供进一步指示。'}`,
            timestamp: Date.now(),
          });
          break;

        // ★ Agent auto-continuing: model responded without tools but task
        // seems incomplete. Agent is injecting a continuation nudge.
        case 'auto_continue':
          // Log for debugging; the continuation message is already in the
          // conversation on the main-process side.
          console.log(`[Quest] Auto-continue: retry ${event.retryCount}/${event.maxRetries}`);
          break;

        // File snapshot for diff review
                case 'file_snapshot':
          if (event.filePath && event.afterContent !== undefined) {
            useQuestDiffStore.getState().addFileChange(
              event.filePath,
              event.beforeContent ?? null,
              event.afterContent,
              event.toolName || '',
              event.isNewFile ?? false
            );

            // Auto-accept file changes based on config or task auto-mode
            const shouldAutoAccept =
              fileChangeBehavior === 'auto-accept' ||
              (event.taskId && useQuestStore.getState().tasks.find((t) => t.id === event.taskId)?.autoMode === 'auto');

            if (shouldAutoAccept) {
              useQuestDiffStore.getState().acceptFile(event.filePath);
            } else if (fileChangeBehavior === 'auto-reject') {
              useQuestDiffStore.getState().rejectFile(event.filePath);
              window.electronAPI.quest.revertFile(event.filePath, event.beforeContent ?? null).catch(() => {});
            }
          }
          break;
// Todo state sync
        case 'todo_update':
          if (event.items) {
            useTodoStore.getState().setItems(event.items);
          }
          break;
      }
    });

    const unsubAsk = window.electronAPI.quest.onAskUser((data: any) => {
      useQuestStore.getState().setAskUserRequest({
        requestId: data.requestId,
        question: data.question,
      });
    });

    const unsubConfirm = window.electronAPI.quest.onConfirmRequest((data: any) => {
      useQuestStore.getState().setConfirmRequest({
        requestId: data.requestId,
        type: data.type,
        toolName: data.toolName,
        args: data.args || {},
        command: data.command,
        planContent: data.planContent,
        planTitle: data.planTitle,
      });
    });

    // Load task list on mount
    useQuestStore.getState().loadTaskList();

    return () => {
      unsubEvent();
      unsubAsk();
      unsubConfirm();
      window.removeEventListener('quest:file-behavior-changed', onBehaviorChange as EventListener);
    };
  }, []);
}
