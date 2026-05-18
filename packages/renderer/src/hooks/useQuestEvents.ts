// Quest Mode event subscription hook
// Mirrors useAgentEvents.ts but listens on quest:* channels
// Dispatches to quest-store and quest-diff-store

import { useEffect } from 'react';
import { useQuestStore, generateQuestMessageId } from '../stores/quest-store';
import { useQuestDiffStore } from '../stores/quest-diff-store';
import { useTodoStore } from '../stores/todo-store';

export function useQuestEvents(): void {
  useEffect(() => {
    // Load maxContextTokens from config for context meter + auto-compact
    window.electronAPI.config.get().then((cfg: any) => {
      if (cfg?.maxContextTokens) {
        useQuestStore.getState().setMaxContextTokens(cfg.maxContextTokens);
      }
    }).catch(() => { /* ignore */ });

    const unsubEvent = window.electronAPI.quest.onEvent((event: any) => {
      const store = useQuestStore.getState();

      // Filter events by activeTaskId to prevent stale-agent pollution
      // Skip filter for cross-task events that update task metadata
      const crossTaskEvents = ['status_change', 'title_change', 'todo_update', 'file_snapshot'];
      const isCrossTask = crossTaskEvents.includes(event.type);
      if (!isCrossTask && event.taskId && event.taskId !== store.activeTaskId) {
        return; // Ignore events from other/old tasks
      }

      // runId epoch filter: discard stale events from old runs.
      // If both the event and the store carry a runId, they must match.
      // Events without a runId (legacy / cross-task) are always accepted.
      if (event.runId && store.activeRunId && event.runId !== store.activeRunId) {
        return; // Stale event from a previous run – drop it
      }

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
          store.setStreaming(false);
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
          store.setStreaming(false);

          // Remove from running tasks
          if (event.taskId) {
            store.removeRunningTask(event.taskId);
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
            store.setTaskStatus(event.taskId, event.status);
            if (event.status === 'running') {
              store.addRunningTask(event.taskId);
              // Ensure streaming flag is set when agent starts running
              if (event.taskId === store.activeTaskId) {
                store.setStreaming(true);
              }
            } else {
              store.removeRunningTask(event.taskId);
              // Reset streaming state for non-running statuses (defense-in-depth)
              if (event.taskId === store.activeTaskId) {
                store.resetStreamText();
                store.setStreaming(false);
              }
            }
          }
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

            // Auto-accept file changes when task is in auto mode
            if (event.taskId) {
              const currentTask = useQuestStore.getState().tasks.find((t) => t.id === event.taskId);
              if (currentTask?.autoMode === 'auto') {
                useQuestDiffStore.getState().acceptFile(event.filePath);
              }
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
    };
  }, []);
}
