// Quest View - orchestrator with three-column Allotment layout

import { useState, useRef, useEffect, useCallback } from 'react';
import { Allotment } from 'allotment';
import { useQuestStore, type QuestTask } from '../../stores/quest-store';
import { useModelStore } from '../../stores/model-store';
import { QuestTaskList } from './QuestTaskList';
import { QuestConversation } from './QuestConversation';
import { QuestArtifacts } from './QuestArtifacts';

/* --- Quick action cards data --- */

const QUICK_ACTIONS: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  scenario: QuestTask['scenario'];
}[] = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    title: 'Spec \u9a71\u52a8',
    desc: '\u9002\u5408\u590d\u6742\u9879\u76ee\u67b6\u6784',
    scenario: 'spec',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
    title: '\u539f\u578b\u63a2\u7d22',
    desc: '\u5f3a\u5927\u524d\u7aef\u80fd\u529b\u652f\u6301',
    scenario: 'prototype',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: '\u521b\u5efa\u5de5\u5177',
    desc: '\u901f\u642d\u81ea\u52a8\u5316\u5de5\u5177',
    scenario: 'tool',
  },
];

/* --- Mode options --- */

const RUN_MODES = [
  { value: 'local', label: '\u672c\u5730\u6a21\u5f0f' },
  { value: 'worktree', label: 'Worktree\u6a21\u5f0f' },
  { value: 'remote', label: '\u8fdc\u7a0b\u6a21\u5f0f' },
];

const AUTO_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
];

/* --- Main Component --- */

export function QuestView() {
  const { tasks, activeTaskId, runningTaskIds } = useQuestStore();

  // Mount: reset streaming state in case we're returning from editor mode.
  // The main-process agent was already aborted on unmount, but the Zustand store
  // may still hold stale isStreaming / runningTaskIds that block new messages.
  useEffect(() => {
    const store = useQuestStore.getState();
    
    // Only reset if truly stale (no actual running agent in main process)
    // We keep runningTaskIds if the task might still be active
    if (store.isStreaming) {
      console.log('[QuestView] Mount: resetting stale streaming state');
      store.resetStreamText();
      store.setStreaming(false);
      store.setActiveRunId(null);
    }
    
    // DO NOT clear runningTaskIds on mount - they may represent real running tasks
    // Only clear if confirmed stale by checking with main process
  }, []);

  // Cleanup: pause (not stop) running agents when leaving quest mode
  useEffect(() => {
    return () => {
      const store = useQuestStore.getState();
      const currentRunId = store.activeRunId;
      const ids = store.runningTaskIds;
      
      if (ids.length > 0) {
        console.log('[QuestView] Unmounting, pausing running agents:', ids);
        // Use stopOnSwitch instead of stop - this preserves task state
        ids.forEach((id) => {
          window.electronAPI.quest.stopOnSwitch(id, currentRunId || undefined).catch(() => {});
        });
      }
      
      // Only reset streaming state, keep runningTaskIds for when we return
      store.resetStreamText();
      store.setStreaming(false);
      store.setActiveRunId(null);
    };
  }, []);

  // Show three-column layout when there are tasks
  if (tasks.length > 0 || activeTaskId) {
    return <QuestWorkspace />;
  }

  // Welcome view when no tasks exist
  return <QuestWelcome />;
}

/* ─── Three-column workspace ─── */

function QuestWorkspace() {
  const { activeTaskId } = useQuestStore();

  return (
    <div className="h-full w-full">
      <Allotment proportionalLayout={false}>
        {/* Left: Task list */}
        <Allotment.Pane preferredSize={220} minSize={160} maxSize={360} snap>
          <QuestTaskList />
        </Allotment.Pane>

        {/* Center: Conversation or empty state */}
        <Allotment.Pane minSize={300}>
          {activeTaskId ? (
            <QuestConversation />
          ) : (
            <QuestEmptyCenter />
          )}
        </Allotment.Pane>

        {/* Right: Artifacts panel (only when task is active) */}
        {activeTaskId && (
          <Allotment.Pane preferredSize={340} minSize={200} maxSize={600} snap>
            <QuestArtifacts />
          </Allotment.Pane>
        )}
      </Allotment>
    </div>
  );
}

/* ─── Empty center state (no active task) ─── */

function QuestEmptyCenter() {
  const { createTask } = useQuestStore();

  const handleCreate = async () => {
    await createTask('spec', 'local', 'auto');
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-cp-bg">
      <div className="text-white/70 text-sm mb-4">
        Select a task from the list, or create a new one.
      </div>
      <button
        onClick={handleCreate}
        className="text-[11px] px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        + New Task
      </button>
    </div>
  );
}

/* ─── Welcome view (no tasks exist) ─── */

function QuestWelcome() {
  const [text, setText] = useState('');
  const [runMode, setRunMode] = useState<string>('local');
  const [autoMode, setAutoMode] = useState<string>('auto');
  const [scenario, setScenario] = useState<QuestTask['scenario']>('spec');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { currentModel, ollamaModels, ollamaConnected, configuredProviders, fetchOllamaModels, loadCurrentConfig, setModel } = useModelStore();
  const { createTask } = useQuestStore();

  useEffect(() => {
    loadCurrentConfig();
    fetchOllamaModels();
    
    // Listen for quest logs from main process
    const unsubscribe = window.electronAPI.quest.onLog((data: any) => {
      console.log('[Quest Main]', data.message, data.data ? JSON.parse(data.data) : '');
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;

    setError(null);
    const message = text.trim();
    console.log('[Quest] handleSend called:', { message, currentModel, scenario, runMode, autoMode });
    setText('');

    // Check model configuration before creating task
    if (!currentModel) {
      setText(message);
      setError('请先配置模型。点击左下角的模型选择器，选择一个模型并配置 API Key。');
      return;
    }

    // Create task
    try {
      console.log('[Quest] Calling createTask...');
      const taskId = await createTask(
        scenario,
        runMode as QuestTask['runMode'],
        autoMode as QuestTask['autoMode'],
      );
      console.log('[Quest] createTask returned:', taskId);
      if (!taskId) {
        setText(message);
        setError('任务创建失败，请打开开发者工具 (F12) 查看控制台错误信息。');
        return;
      }

      // Run quest with the initial message
      const store = useQuestStore.getState();
      store.addMessage({
        id: `qmsg-${Date.now()}-init`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });
      store.setStreaming(true);
      store.resetStreamText();
      store.addRunningTask(taskId);

      // Generate run epoch ID
      const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      store.setActiveRunId(runId);

      console.log('[Quest] Calling quest.run...');
      await window.electronAPI.quest.run({
        taskId,
        message,
        scenario,
        runMode: runMode as QuestTask['runMode'],
        autoMode: autoMode as QuestTask['autoMode'],
        runId,
      });
      console.log('[Quest] quest.run completed');
    } catch (err) {
      console.error('[Quest] Error in handleSend:', err);
      setError(`任务运行失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setText(message);
    }
  }, [text, scenario, runMode, autoMode, createTask, currentModel]);

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    setScenario(action.scenario);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <h1 className="text-[32px] font-semibold text-cp-text mb-10 tracking-tight text-center">
          Quest on, hands off
        </h1>

        <div className="w-full max-w-[740px] mx-auto">
          {/* Input card */}
          <div className="relative bg-cp-panel border border-cp-border/60 rounded-2xl focus-within:border-white/30 transition-colors">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="\u8bf4\u51fa\u4f60\u60f3\u8981\u7684\uff0cQuest \u4f1a\u51b3\u5b9a\u63a5\u4e0b\u6765\u600e\u4e48\u505a"
              rows={2}
              className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-cp-text outline-none resize-none min-h-[60px] placeholder:text-cp-text-dim/40 leading-relaxed rounded-t-2xl"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                <ModelDropdown
                  currentModel={currentModel}
                  ollamaModels={ollamaModels}
                  ollamaConnected={ollamaConnected}
                  configuredProviders={configuredProviders}
                  onSelect={setModel}
                />
                <MiniDropdown value={runMode} options={RUN_MODES} onChange={setRunMode} />
                <MiniDropdown value={autoMode} options={AUTO_MODES} onChange={setAutoMode} />
              </div>
              <div className="flex items-center gap-0.5">
                <IconButton title="\u53d1\u9001 (Enter)" onClick={handleSend}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Quick action cards */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.title}
                onClick={() => handleQuickAction(action)}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border bg-white/[0.02]
                  text-left hover:bg-white/[0.05] hover:border-white/30 transition-all group ${
                    scenario === action.scenario
                      ? 'border-cp-accent/50 bg-cp-accent/5'
                      : 'border-cp-border/50'
                  }`}
              >
                <div className={`mt-0.5 shrink-0 transition-colors ${
                  scenario === action.scenario
                    ? 'text-cp-accent'
                    : 'text-white/60 group-hover:text-white'
                }`}>
                  {action.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-cp-text font-medium">{action.title}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Model Dropdown ─── */

interface ConfiguredProvider {
  key: string;
  name: string;
  color: string;
  models: string[];
}

function ModelDropdown({
  currentModel,
  ollamaModels,
  ollamaConnected,
  configuredProviders,
  onSelect,
}: {
  currentModel: string;
  ollamaModels: string[];
  ollamaConnected: boolean;
  configuredProviders: ConfiguredProvider[];
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = currentModel
    ? currentModel.includes(':') ? currentModel.split(':').slice(1).join(':') : currentModel
    : '\u9009\u62e9\u6a21\u578b';

  const hasModels = ollamaModels.length > 0 || configuredProviders.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors max-w-[200px]"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span className="truncate">{displayName}</span>
        <svg className="w-3 h-3 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-cp-panel border border-cp-border/60 rounded-lg shadow-xl z-[100] min-w-[240px] max-w-[320px] py-1 max-h-[360px] overflow-y-auto">
          {!hasModels && (
            <div className="px-3 py-3 text-[11px] text-white/60 text-center">
              \u672a\u914d\u7f6e\u4efb\u4f55\u6a21\u578b\uff0c\u8bf7\u5728\u8bbe\u7f6e &gt; \u6a21\u578b\u4e2d\u914d\u7f6e
            </div>
          )}

          {ollamaModels.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${ollamaConnected ? 'bg-green-500' : 'bg-white/15'}`} />
                Ollama \u672c\u5730\u6a21\u578b
              </div>
              {ollamaModels.map((m) => {
                const fullId = `ollama:${m}`;
                return (
                  <button key={fullId} onClick={() => { onSelect(fullId); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${currentModel === fullId ? 'text-cp-text bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                  >
                    <span className="truncate">{m}</span>
                    {currentModel === fullId && <CheckIcon />}
                  </button>
                );
              })}
            </>
          )}

          {configuredProviders.map((provider) => (
            <div key={provider.key}>
              <div className="px-3 py-1.5 text-[10px] text-white/60 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {provider.name}
              </div>
              {provider.models.map((m) => {
                const fullId = `${provider.key}:${m}`;
                return (
                  <button key={fullId} onClick={() => { onSelect(fullId); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${currentModel === fullId ? 'text-cp-text bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                  >
                    <span className="truncate">{m}</span>
                    {currentModel === fullId && <CheckIcon />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-cp-accent shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/* ─── Mini Dropdown ─── */

function MiniDropdown({
  icon,
  value,
  options,
  onChange,
}: {
  icon?: React.ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        {icon}
        <span>{current?.label}</span>
        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-cp-panel border border-cp-border/60 rounded-lg shadow-xl z-[100] min-w-[120px] py-1">
          {options.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${opt.value === value ? 'text-cp-text bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Icon Button ─── */

function IconButton({
  children, title, onClick, active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button title={title} onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${active ? 'text-cp-accent bg-cp-accent/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}
