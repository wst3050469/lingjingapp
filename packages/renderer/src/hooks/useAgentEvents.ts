import { useEffect } from 'react';
import { useChatStore, generateMessageId, saveSessionSnapshot } from '../stores/chat-store';
import { useAuthStore } from '../stores/auth-store';
import { useEditTrackerStore } from '../stores/edit-tracker-store';
import { useConfirmationStore } from '../stores/confirmation-store';
import { useTodoStore } from '../stores/todo-store';
import { useExpertsStore } from '../stores/experts-store';
import { useDiffReviewStore } from '../stores/diff-review-store';
import { generateRecommendations } from '../components/chat/RecommendationCards';

const FILE_TOOLS = ['file_write', 'file_edit'];

/**
 * Centralized agent event subscription hook.
 * Call ONCE in App.tsx MainLayout — not per chat component.
 * Handles: thinking, text, tool_start, tool_progress, tool_end, usage, error, done, askUser,
 *          todo_update, expert_dispatch_start/end, expert_task_start/progress/end
 */
export function useAgentEvents(): void {
  useEffect(() => {
    // Load maxContextTokens from config for context meter
    window.electronAPI.config.get().then((cfg: any) => {
      if (cfg?.maxContextTokens) {
        useChatStore.getState().setMaxContextTokens(cfg.maxContextTokens);
      }
    }).catch(() => { /* ignore */ });

    // Safety watchdog: if isStreaming is stuck for 30s without any event, force reset
    let streamingWatchdog: ReturnType<typeof setTimeout> | null = null;
    const startWatchdog = () => {
      if (streamingWatchdog) clearTimeout(streamingWatchdog);
      streamingWatchdog = setTimeout(() => {
        const store = useChatStore.getState();
        if (store.isStreaming) {
          console.warn('[AgentEvents] Watchdog: isStreaming stuck for 30s, force resetting');
          store.setStreaming(false);
          store.resetStreamText();
        }
      }, 30000);
    };

    // Also start watchdog whenever isStreaming becomes true
    const unsubStreaming = useChatStore.subscribe((state, prev) => {
      if (state.isStreaming && !prev.isStreaming) {
        startWatchdog();
      }
    });

    const unsubEvent = window.electronAPI.agent.onEvent((event: any) => {
      const store = useChatStore.getState();
      switch (event.type) {
        case 'thinking':
          store.flushStreamText();
          startWatchdog();
          // Clear previous review session when a new agent run starts
          useDiffReviewStore.getState().clearReview();
          break;
        case 'text':
          store.appendStreamText(event.text);
          break;
        case 'tool_start': {
          store.flushStreamText();
          store.addMessage({
            id: generateMessageId(),
            role: 'tool',
            content: `Running tool: ${event.name}`,
            toolCalls: [{ name: event.name, args: event.args || {} }],
            timestamp: Date.now(),
          });
          // Track file edits
          if (FILE_TOOLS.includes(event.name) && event.args?.file_path) {
            useEditTrackerStore.getState().addEdit(event.args.file_path as string, event.name);
          }
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
          // Update file edit status
          if (FILE_TOOLS.includes(event.name) && event.args?.file_path) {
            const status = event.result?.isError ? 'error' : 'applied';
            useEditTrackerStore.getState().updateEditStatus(event.args.file_path as string, status);
          }
          break;
        case 'usage':
          store.setLastUsage({
            inputTokens: event.inputTokens ?? 0,
            outputTokens: event.outputTokens ?? 0,
          });
          store.updateCumulativeTokens();
          break;
        case 'error':
          store.addMessage({
            id: generateMessageId(),
            role: 'assistant',
            content: `Error: ${event.error?.message || 'Unknown error'}`,
            timestamp: Date.now(),
          });
          store.setStreaming(false);
          if (streamingWatchdog) clearTimeout(streamingWatchdog);
          break;
        case 'done': {
          // CRITICAL: setStreaming(false) must run first, before any other logic
          // that could potentially throw and leave isStreaming stuck at true
          store.setStreaming(false);
          if (streamingWatchdog) clearTimeout(streamingWatchdog);

          const streamText = useChatStore.getState().currentStreamText;
          if (streamText) {
            store.addMessage({
              id: generateMessageId(),
              role: 'assistant',
              content: streamText,
              timestamp: Date.now(),
            });
          }
          store.resetStreamText();

          // Generate recommendations from last assistant message
          try {
            const msgs = useChatStore.getState().messages;
            const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant) {
              store.setRecommendations(generateRecommendations(lastAssistant.content));
            }
          } catch { /* non-critical */ }

          // Auto-save conversation
          try {
            const { user } = useAuthStore.getState();
            if (user?.id) {
              useChatStore.getState().saveCurrentConversation(user.id);
            }
          } catch { /* non-critical */ }

          // Activate diff review if there are file changes
          try {
            if (Object.keys(useDiffReviewStore.getState().fileChanges).length > 0) {
              useDiffReviewStore.getState().activateReview();
            }
          } catch { /* non-critical */ }

          // Auto-compact: check if conversation needs compaction after each response.
          // This runs here (always-mounted hook) instead of in ChatPanel (conditionally rendered).
          try {
            useChatStore.getState().autoCompactIfNeeded();
          } catch { /* non-critical */ }
          break;
        }
        // File snapshot for diff review
        case 'file_snapshot':
          if (event.filePath && event.afterContent !== undefined) {
            useDiffReviewStore.getState().addFileChange(
              event.filePath,
              event.beforeContent ?? null,
              event.afterContent,
              event.toolName || '',
              event.isNewFile ?? false
            );
          }
          break;
        // Todo state sync
        case 'todo_update':
          if (event.items) {
            useTodoStore.getState().setItems(event.items);
          }
          break;
        // Expert dispatch events
        case 'expert_dispatch_start': {
          const expertTasks = (event.tasks || []).map((t: any) => ({
            id: t.id,
            expertType: t.expertType,
            title: t.title,
            status: 'pending' as const,
            progress: '',
          }));
          useExpertsStore.getState().startDispatch(expertTasks);
          break;
        }
        case 'expert_task_start':
          if (event.taskId) {
            useExpertsStore.getState().updateTaskStatus(event.taskId, 'running');
          }
          break;
        case 'expert_task_progress':
          if (event.taskId && event.text) {
            useExpertsStore.getState().appendTaskProgress(event.taskId, event.text);
          }
          break;
        case 'expert_task_end':
          if (event.taskId) {
            const status = event.isError ? 'failed' : 'completed';
            useExpertsStore.getState().updateTaskStatus(
              event.taskId,
              status,
              event.result ?? event.text,
              event.isError
            );
          }
          break;
        case 'expert_dispatch_end':
          useExpertsStore.getState().setDispatchSummary({
            total: event.totalTasks ?? 0,
            succeeded: event.succeeded ?? 0,
            failed: event.failed ?? 0,
          });
          break;
        // Intervention injected
        case 'intervention_injected':
          if (event.text) {
            useExpertsStore.getState().markInterventionInjected(event.text);
          }
          break;
        // Code Review Report
        case 'code_review_report':
          if (event.report) {
            // Add a message with the report metadata
            store.addMessage({
              id: generateMessageId(),
              role: 'assistant',
              content: `🔍 Code Review Complete\n\n${event.report.summary}`,
              metadata: {
                type: 'code_review_report',
                report: event.report,
              },
              timestamp: Date.now(),
            });
          }
          break;
      }
    });

    const unsubAsk = window.electronAPI.agent.onAskUser((data: any) => {
      useChatStore.getState().setAskUserRequest({
        requestId: data.requestId,
        question: data.question,
      });
    });

    const unsubConfirm = window.electronAPI.agent.onConfirmRequest((data: any) => {
      useConfirmationStore.getState().setRequest({
        requestId: data.requestId,
        type: data.type,
        toolName: data.toolName,
        args: data.args || {},
        command: data.command,
        planContent: data.planContent,
        planTitle: data.planTitle,
      });
    });

    return () => {
      unsubEvent();
      unsubAsk();
      unsubConfirm();
      unsubStreaming();
      if (streamingWatchdog) clearTimeout(streamingWatchdog);
    };
  }, []);
}
