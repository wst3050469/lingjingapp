/**
 * scifi-dark 主题切换入口 — 纯数据（无 React 依赖）
 *
 * 此文件是 patch-theme-switch.tsx 的无 JSX 存根，
 * 仅导出 CSS 变量和主题选项常量，供 Electron 主进程和 Node.js 上下文中使用。
 *
 * 集成说明：
 * 1. ThemeContext.tsx → 在 themes 对象中添加 'scifi-dark' 主题定义
 * 2. ThemeName 类型 → 扩展为 'dark' | 'light' | 'scifi-dark'
 * 3. StatusBar.tsx → 主题切换菜单中添加 scifi-dark 选项（下拉选择替代简单 toggle）
 * 4. ui-store.ts → ThemeMode 类型扩展为 'dark' | 'light' | 'scifi-dark'
 */

export const SCIFI_THEME_OPTION = {
  id: 'scifi-dark' as const,
  label: 'Sci-Fi 深空',
  icon: '🚀',
};

export type ScifiThemeId = typeof SCIFI_THEME_OPTION.id;

// scifi-dark 主题的 CSS 变量映射
export const SCIFI_DARK_CSS_VARS: Record<string, string> = {
  '--cp-bg': '#0a0e1a',
  '--cp-sidebar': '#0f1428',
  '--cp-editor': '#0a0e1a',
  '--cp-panel': '#0f1428',
  '--cp-statusbar': '#1a1040',
  '--cp-activitybar': '#0c1022',
  '--cp-tab-active': '#0a0e1a',
  '--cp-tab-inactive': '#111633',
  '--cp-border': '#1e2a5a',
  '--cp-text': '#e0e6ff',
  '--cp-text-dim': '#7b8cd6',
  '--cp-accent': '#6c5ce7',
  '--cp-success': '#00cec9',
  '--cp-error': '#ff6b6b',
  '--cp-warning': '#feca57',
  '--cp-info': '#48dbfb',
};

// 主题选项列表（用于 StatusBar 下拉选择）
export const THEME_OPTIONS = [
  { id: 'dark' as const, label: '深色', icon: '🌙' },
  { id: 'light' as const, label: '浅色', icon: '☀️' },
  SCIFI_THEME_OPTION,
] as const;

export type ExtendedThemeMode = 'dark' | 'light' | 'scifi-dark';
