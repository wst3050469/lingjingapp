import { useUIStore, type SidebarPanel } from '../../stores/ui-store';

const sidebarIcons: { id: SidebarPanel; title: string; icon: JSX.Element }[] = [
  {
    id: 'dashboard',
    title: '首页仪表盘',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    id: 'explorer',
    title: '资源管理器 (Ctrl+Shift+E)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    id: 'search',
    title: '搜索 (Ctrl+Shift+F)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    id: 'chat',
    title: 'AI 对话 (Ctrl+Shift+A)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    id: 'git',
    title: '源代码管理 (Ctrl+Shift+G)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6m0 0a3 3 0 100 6 3 3 0 000-6zm0 6v6m-6-9a3 3 0 100-6 3 3 0 000 6zm0 0v3a3 3 0 003 3h3" />
      </svg>
    ),
  },
  {
    id: 'run-debug',
    title: '运行和调试 (Ctrl+Shift+D)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25A3 3 0 018.25 2h7.5a3 3 0 013 3.25v9.75a3 3 0 01-3 3h-7.5a3 3 0 01-3-3v-9.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18v-3.75m0 0l3 3m-3-3l-3 3M8.25 18v-3.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v-3" />
        <path d="M8 5l2 2-2 2M5 9h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'extension',
    title: '扩展 (Ctrl+Shift+X)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.225-.29.349-.634.349-1.003 0-1.036-1.2-2.125-2.75-2.125S9 3.089 9 4.125c0 .369.124.713.349 1.003.215.283.401.604.401.959v7.916c0 .355-.186.676-.401.959-.225.29-.349.634-.349 1.003 0 1.036 1.2 2.125 2.75 2.125s2.75-1.089 2.75-2.125c0-.369-.124-.713-.349-1.003-.215-.283-.401-.604-.401-.959V6.087z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 6.087c0-.355.186-.676.401-.959.225-.29.349-.634.349-1.003 0-1.036-1.2-2.125-2.75-2.125S5 3.089 5 4.125c0 .369.124.713.349 1.003.215.283.401.604.401.959v7.916c0 .355-.186.676-.401.959-.225.29-.349.634-.349 1.003 0 1.036 1.2 2.125 2.75 2.125s2.75-1.089 2.75-2.125c0-.369-.124-.713-.349-1.003-.215-.283-.401-.604-.401-.959V6.087z" />
      </svg>
    ),
  },
  {
    id: 'workflow',
    title: '工作流 (Ctrl+Shift+W)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217 456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'remote',
    title: '远程连接 (Ctrl+Shift+R)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.285 1.286 1.285 3.37 0 4.656l-.47.47a3.288 3.288 0 01-4.656 0l-1.402-1.402M5 14.5l-1.402 1.402a3.288 3.288 0 000 4.656l.47.47c1.286 1.286 3.37 1.286 4.656 0L10.126 19.6M12 18v-3.75m0 0c-.251.023-.501.05-.75.082m.75-.082c.251.023.501.05.75.082" />
      </svg>
    ),
  },
  {
    id: 'pipeline',
    title: 'CI/CD 流水线',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: 'review',
    title: '代码审查',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.5 1.5 0 011.32-.887h5.288a1.5 1.5 0 011.32.887l.944 2.1a1.5 1.5 0 01-.33 1.623l-3.393 3.393a1.5 1.5 0 01-2.122 0L2.17 15.045a1.5 1.5 0 01-.33-1.623l.944-2.1zM12 3.75a.75.75 0 01.75.75v6.75l2.25 2.25H12" />
      </svg>
    ),
  },
  {
    id: 'pm',
    title: '项目管理 (看板)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h4.5v4.5h-4.5v-4.5zM10.5 3.75h4.5v4.5h-4.5v-4.5zM17.25 3.75h4.5v4.5h-4.5v-4.5zM3.75 10.5h4.5v4.5h-4.5v-4.5zM10.5 10.5h4.5v4.5h-4.5v-4.5z" />
      </svg>
    ),
  },
  {
    id: 'security',
    title: '安全扫描',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.599-7.86-4.175z" />
      </svg>
    ),
  },
  {
    id: 'fusion-settings',
    title: 'Fusion 融合引擎',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25l-10.5 11.25L12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: 'openspace',
    title: 'OpenSpace 宇宙',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.563A.562.562 0 019 14.437V9.563z" />
      </svg>
    ),
  },
];

export function ActivityBar() {
  const { activeSidebarPanel, showSidebar, showWikiPanel, setSidebarPanel, setShowSettingsModal, toggleWikiPanel } = useUIStore();

  return (
    <div className="w-12 bg-cp-activitybar flex flex-col items-center py-1 shrink-0 border-r border-cp-border">
      {/* Sidebar panel icons */}
      <div className="flex flex-col items-center gap-0.5">
        {sidebarIcons.map((item) => {
          const isActive = showSidebar && activeSidebarPanel === item.id;
          return (
            <button
              key={item.id}
              title={item.title}
              onClick={() => setSidebarPanel(item.id)}
              className={`w-12 h-12 flex items-center justify-center transition-colors relative ${
                isActive
                  ? 'text-cp-text'
                  : 'text-cp-text-dim/50 hover:text-cp-text'
              }`}
            >
              {/* Active indicator - left white border */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
              {item.icon}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Admin + Wiki + Settings */}
      <button
        title="Repo Wiki (Ctrl+Shift+O)"
        onClick={toggleWikiPanel}
        className={`w-12 h-12 flex items-center justify-center transition-colors relative ${
          showWikiPanel
            ? 'text-cp-text'
            : 'text-cp-text-dim/50 hover:text-cp-text'
        }`}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </button>
      <button
        title="管理员 (SSH + 远程命令)"
        onClick={() => setSidebarPanel('admin')}
        className="w-12 h-12 flex items-center justify-center text-cp-text-dim/50 hover:text-cp-text"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17a8.215 8.215 0 01-2.653-1.62 8.23 8.23 0 01-1.62-2.655m4.272 4.275a8.023 8.023 0 01-.422 1.538 8.25 8.25 0 01-1.607 2.73m4.03-4.268a8.25 8.25 0 011.538-.421m-5.568 4.689a8.21 8.21 0 002.111 1.572 8.25 8.25 0 002.62.788m-4.731-2.36a8.252 8.252 0 00-2.11-1.572m4.73 2.36a8.25 8.25 0 001.607 2.73m-6.337-6.337a8.25 8.25 0 00-2.73-1.607M3 12a9 9 0 1118 0 9 9 0 01-18 0zm9-3a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      </button>
      <button
        title="设置 (Ctrl+,)"
        onClick={() => setShowSettingsModal(true)}
        className="w-12 h-12 flex items-center justify-center text-cp-text-dim/50 hover:text-cp-text transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}
