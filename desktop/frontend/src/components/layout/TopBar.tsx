import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { useChatStore } from '../../stores/chat-store';
import { useEditorStore } from '../../stores/editor-store';
import { useTheme } from '../../contexts/ThemeContext';

/* ─── Menu definitions ─── */

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  hasSubmenu?: boolean;
  toggle?: boolean;
}

interface MenuDef {
  label: string;
  hotkey: string;
  items: MenuItem[];
}

/* ─── File actions ─── */

async function actionNewFile() {
  const filePath = await window.electronAPI?.fs?.saveAs?.('untitled');
  if (filePath) {
    await window.electronAPI?.fs?.writeFile?.(filePath, '');
    const name = filePath.split(/[\\/]/).pop() || 'untitled';
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const langMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescriptreact',
      '.js': 'javascript', '.jsx': 'javascriptreact',
      '.json': 'json', '.html': 'html', '.css': 'css',
      '.md': 'markdown', '.py': 'python', '.go': 'go',
      '.rs': 'rust', '.java': 'java',
    };
    useEditorStore.getState().openFile({
      path: filePath, name, language: langMap[ext] || 'plaintext', content: '', isDirty: false,
    });
    useUIStore.getState().setViewMode('editor');
  }
}

async function actionOpenFile() {
  const filePaths = await window.electronAPI?.fs?.selectFile?.();
  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0];
    try {
      const { content, language } = await window.electronAPI.fs.readFile(filePath);
      const name = filePath.split(/[\\/]/).pop() || 'unknown';
      useEditorStore.getState().openFile({ path: filePath, name, language, content, isDirty: false });
      useUIStore.getState().setViewMode('editor');
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }
}

async function actionOpenFolder() {
  const path = await window.electronAPI?.fs?.selectFolder?.();
  if (path) {
    window.electronAPI?.config?.setWorkspace?.(path);
    useUIStore.getState().setSidebarPanel('explorer');
  }
}

async function actionSave() {
  const { activeFilePath, openFiles } = useEditorStore.getState();
  if (!activeFilePath) return;
  const file = openFiles.find(f => f.path === activeFilePath);
  if (!file || !file.isDirty) return;
  try {
    await window.electronAPI?.fs?.writeFile?.(file.path, file.content);
    useEditorStore.getState().markDirty(file.path, false);
  } catch (err) {
    console.error('Failed to save:', err);
  }
}

async function actionSaveAs() {
  const { activeFilePath, openFiles } = useEditorStore.getState();
  const file = activeFilePath ? openFiles.find(f => f.path === activeFilePath) : null;
  const defaultName = file?.name;
  const filePath = await window.electronAPI?.fs?.saveAs?.(defaultName);
  if (filePath && file) {
    try {
      await window.electronAPI?.fs?.writeFile?.(filePath, file.content);
    } catch (err) {
      console.error('Failed to save as:', err);
    }
  }
}

async function actionSaveAll() {
  const { openFiles } = useEditorStore.getState();
  const dirtyFiles = openFiles.filter(f => f.isDirty);
  for (const file of dirtyFiles) {
    try {
      await window.electronAPI?.fs?.writeFile?.(file.path, file.content);
      useEditorStore.getState().markDirty(file.path, false);
    } catch (err) {
      console.error('Failed to save:', file.path, err);
    }
  }
}

function actionCloseEditor() {
  const { activeFilePath } = useEditorStore.getState();
  if (activeFilePath) {
    useEditorStore.getState().closeFile(activeFilePath);
  }
}

async function actionRevertFile() {
  const { activeFilePath } = useEditorStore.getState();
  if (!activeFilePath) return;
  try {
    const { content } = await window.electronAPI.fs.readFile(activeFilePath);
    useEditorStore.getState().reloadFile(activeFilePath, content);
  } catch (err) {
    console.error('Failed to revert file:', err);
  }
}

function actionCloseFolder() {
  window.electronAPI?.config?.setWorkspace?.('');
}

function buildMenus(): MenuDef[] {
  return [
    {
      label: '文件',
      hotkey: 'F',
      items: [
        { label: '新建文本文件', shortcut: 'Ctrl+N', action: () => {
          const store = useEditorStore.getState();
          const untitledCount = store.openFiles.filter(f => f.name.startsWith('Untitled')).length;
          const name = untitledCount === 0 ? 'Untitled-1' : `Untitled-${untitledCount + 1}`;
          store.openFile({ path: `untitled://${name}`, name, language: 'plaintext', content: '', isDirty: false });
          useUIStore.getState().setViewMode('editor');
        }},
        { label: '新建文件...', shortcut: 'Ctrl+Alt+N', action: actionNewFile },
        { label: '新建窗口', shortcut: 'Ctrl+Shift+N', action: () => window.electronAPI?.window?.newWindow?.() },
        { label: '使用配置文件新建窗口', hasSubmenu: true, disabled: true },
        { label: '', divider: true },
        { label: '打开文件...', shortcut: 'Ctrl+O', action: actionOpenFile },
        { label: '打开文件夹...', shortcut: 'Ctrl+K Ctrl+O', action: actionOpenFolder },
        { label: '从文件打开工作区...', disabled: true },
        { label: '打开最近的文件', hasSubmenu: true, disabled: true },
        { label: '', divider: true },
        { label: '将文件夹添加到工作区...', disabled: true },
        { label: '将工作区另存为...', disabled: true },
        { label: '复制工作区', disabled: true },
        { label: '', divider: true },
        { label: '保存', shortcut: 'Ctrl+S', action: actionSave },
        { label: '另存为...', shortcut: 'Ctrl+Shift+S', action: actionSaveAs },
        { label: '全部保存', shortcut: 'Ctrl+K S', action: actionSaveAll },
        { label: '', divider: true },
        { label: '共享', hasSubmenu: true, disabled: true },
        { label: '', divider: true },
        { label: '自动保存', toggle: true, disabled: true },
        { label: '首选项', hasSubmenu: true, action: () => useUIStore.getState().setShowSettingsModal(true) },
        { label: '', divider: true },
        { label: '还原文件', action: actionRevertFile },
        { label: '关闭编辑器', shortcut: 'Ctrl+W', action: actionCloseEditor },
        { label: '关闭文件夹', shortcut: 'Ctrl+K F', action: actionCloseFolder },
        { label: '关闭窗口', shortcut: 'Alt+F4', action: () => window.electronAPI?.window?.close?.() },
        { label: '', divider: true },
        { label: '退出', action: () => window.electronAPI?.window?.close?.() },
      ],
    },
    {
      label: '编辑',
      hotkey: 'E',
      items: [
        { label: '撤消', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { label: '恢复', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
        { label: '', divider: true },
        { label: '剪切', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
        { label: '复制', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
        { label: '粘贴', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
        { label: '', divider: true },
        { label: '查找', shortcut: 'Ctrl+F', action: () => {
          const evt = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', ctrlKey: true, bubbles: true });
          document.dispatchEvent(evt);
        }},
        { label: '替换', shortcut: 'Ctrl+H', action: () => {
          const evt = new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', ctrlKey: true, bubbles: true });
          document.dispatchEvent(evt);
        }},
        { label: '', divider: true },
        { label: '在文件中查找', shortcut: 'Ctrl+Shift+F', action: () => useUIStore.getState().setSidebarPanel('search') },
        { label: '在文件中替换', shortcut: 'Ctrl+Shift+H', disabled: true },
        { label: '', divider: true },
        { label: '切换行注释', shortcut: 'Ctrl+/', disabled: true },
        { label: '切换块注释', shortcut: 'Shift+Alt+A', disabled: true },
        { label: 'Emmet: 展开缩写', shortcut: 'Tab', disabled: true },
      ],
    },
    {
      label: '选择',
      hotkey: 'S',
      items: [
        { label: '全选', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
        { label: '清空选择', action: () => window.getSelection()?.removeAllRanges() },
      ],
    },
    {
      label: '查看',
      hotkey: 'V',
      items: [
        { label: 'Editor 模式', action: () => useUIStore.getState().setViewMode('editor') },
        { label: 'Quest 模式', action: () => useUIStore.getState().setViewMode('quest') },
        { label: '', divider: true },
        { label: '资源管理器', shortcut: 'Ctrl+Shift+E', action: () => useUIStore.getState().setSidebarPanel('explorer') },
        { label: '搜索', shortcut: 'Ctrl+Shift+F', action: () => useUIStore.getState().setSidebarPanel('search') },
        { label: 'AI 对话', shortcut: 'Ctrl+Shift+A', action: () => useUIStore.getState().setSidebarPanel('chat') },
        { label: '源代码管理', shortcut: 'Ctrl+Shift+G', action: () => useUIStore.getState().setSidebarPanel('git') },
        { label: '', divider: true },
        { label: '终端', shortcut: 'Ctrl+`', action: () => useUIStore.getState().openBottomPanel('terminal') },
        { label: '问题', action: () => useUIStore.getState().openBottomPanel('problems') },
        { label: '', divider: true },
        { label: '切换侧栏', shortcut: 'Ctrl+B', action: () => useUIStore.getState().toggleSidebar() },
        { label: '切换底部面板', shortcut: 'Ctrl+J', action: () => useUIStore.getState().toggleBottomPanel() },
        { label: '', divider: true },
        { label: '放大', shortcut: 'Ctrl+=', action: () => window.electronAPI?.window?.zoomIn?.() },
        { label: '缩小', shortcut: 'Ctrl+-', action: () => window.electronAPI?.window?.zoomOut?.() },
        { label: '重置缩放', shortcut: 'Ctrl+0', action: () => window.electronAPI?.window?.zoomReset?.() },
      ],
    },
    {
      label: '转到',
      hotkey: 'G',
      items: [
        { label: '返回', shortcut: 'Alt+Left', disabled: true },
        { label: '前进', shortcut: 'Alt+Right', disabled: true },
        { label: '', divider: true },
        { label: '转到文件...', shortcut: 'Ctrl+P', disabled: true },
      ],
    },
    {
      label: '运行',
      hotkey: 'R',
      items: [
        { label: '新建任务', action: () => {
          useChatStore.getState().createNewConversation();
          useUIStore.getState().setViewMode('quest');
        }},
        { label: '停止生成', shortcut: 'Esc', action: () => window.electronAPI?.agent?.abort?.() },
      ],
    },
    {
      label: '终端',
      hotkey: 'T',
      items: [
        { label: '新建终端', shortcut: 'Ctrl+`', action: () => useUIStore.getState().openBottomPanel('terminal') },
        { label: '拆分终端', disabled: true },
      ],
    },
    {
      label: '工作流',
      hotkey: 'W',
      items: [
        { label: '新建工作流', shortcut: 'Ctrl+Shift+N', action: () => {
          useUIStore.getState().setSidebarPanel('workflow');
        }},
        { label: '打开工作流', shortcut: 'Ctrl+Shift+O', action: () => {
          useUIStore.getState().setSidebarPanel('workflow');
        }},
        { label: '', divider: true },
        { label: '工作流设置', action: () => {
          useUIStore.getState().setShowSettingsModal(true);
        }},
        { label: '', divider: true },
        { label: 'Connector管理', action: () => {
          useUIStore.getState().setShowSettingsModal(true);
        }},
        { label: 'Trigger管理', action: () => {
          useUIStore.getState().setShowSettingsModal(true);
        }},
      ],
    },
    {
      label: '帮助',
      hotkey: 'H',
      items: [
        { label: '欢迎', action: () => useUIStore.getState().setViewMode('quest') },
        { label: '', divider: true },
        { label: '文档', disabled: true },
        { label: '报告问题', disabled: true },
        { label: '打开开发者工具', shortcut: 'F12', action: () => window.electronAPI?.window?.openDevTools?.() },
        { label: '', divider: true },
        { label: '关于灵境', action: async () => {
          try {
            const version = await window.electronAPI?.app?.getVersion?.();
            const platform = await window.electronAPI?.app?.platform?.();
            alert(`灵境 (LingJing)\n版本: ${version || '未知'}\n平台: ${platform || '未知'}\n\nAI 编程助手`);
          } catch {
            alert('灵境 (LingJing)\nAI 编程助手');
          }
        }},
      ],
    },
  ];
}

/* ─── TopBar Component ─── */

export function TopBar() {
  const { viewMode, setViewMode, setShowSettingsModal, activeTopTab, setActiveTopTab } = useUIStore();
  const { toggleTheme, themeName } = useTheme();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (openMenu === null) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  // Close menu on Escape
  useEffect(() => {
    if (openMenu === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openMenu]);

  const menus = buildMenus();

  return (
    <div
      ref={barRef}
      className="h-9 bg-cp-sidebar border-b border-cp-border flex items-center shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Menu bar */}
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {menus.map((menu, idx) => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
              onMouseEnter={() => { if (openMenu !== null) setOpenMenu(idx); }}
              className={`h-9 px-2.5 text-[12px] transition-colors ${
                openMenu === idx
                  ? 'bg-cp-surface text-cp-text'
                  : `text-cp-text-dim hover:text-cp-text ${themeName === 'dark' ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.05]'}`
              }`}
            >
              {menu.label}({menu.hotkey})
            </button>

            {openMenu === idx && (
              <div className="absolute left-0 top-full bg-cp-panel border border-cp-border rounded-md shadow-2xl z-[200] min-w-[260px] py-1">
                {menu.items.map((item, i) =>
                  item.divider ? (
                    <div key={`d-${i}`} className="h-px bg-cp-border opacity-30 my-1 mx-2" />
                  ) : (
                    <button
                      key={`${item.label}-${i}`}
                      disabled={item.disabled}
                      onClick={() => {
                        if (!item.hasSubmenu) setOpenMenu(null);
                        item.action?.();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] transition-colors ${
                        item.disabled
                          ? 'text-cp-text-dim opacity-25 cursor-default'
                          : `text-cp-text-dim hover:text-cp-text ${themeName === 'dark' ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.08]'}`
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="flex items-center gap-2">
                        {item.shortcut && (
                          <span className="text-[11px] text-cp-text-dim opacity-30">{item.shortcut}</span>
                        )}
                        {item.hasSubmenu && (
                          <svg className="w-3 h-3 text-cp-text-dim opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Center: View mode tabs */}
      <div className="flex-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => setViewMode('editor')}
          className={`px-3 py-0.5 rounded text-[12px] transition-colors ${
            viewMode === 'editor' ? 'text-cp-text' : 'text-cp-text-dim/50 hover:text-cp-text-dim'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setViewMode('quest')}
          className={`px-2.5 py-0.5 rounded text-[12px] transition-colors ${
            viewMode === 'quest'
              ? 'bg-cp-accent text-cp-text rounded-md font-medium'
              : 'text-cp-text-dim/50 hover:text-cp-text-dim'
          }`}
        >
          Quest
        </button>
      </div>
      <div className="flex-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Right: Theme toggle + Settings */}
      <div className="flex items-center justify-end pr-2 gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={toggleTheme}
          title={themeName === 'dark' ? '切换亮色主题' : '切换暗色主题'}
          className="w-7 h-7 flex items-center justify-center rounded text-cp-text-dim hover:text-cp-text ${themeName === 'dark' ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.05]'} transition-colors"
          aria-label={themeName === 'dark' ? '切换亮色主题' : '切换暗色主题'}
        >
          {themeName === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 003 12c0 4.97 4.03 9 9 9 .526 0 1.04-.05 1.54-.15a7 7 0 01-7.48-3.86 7 7 0 013.86-7.48z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          title="设置 (Ctrl+,)"
          className={`w-7 h-7 flex items-center justify-center rounded text-cp-text-dim hover:text-cp-text transition-colors ${themeName === 'dark' ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.05]'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
