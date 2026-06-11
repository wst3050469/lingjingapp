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
export declare const SCIFI_THEME_OPTION: {
    id: "scifi-dark";
    label: string;
    icon: string;
};
export type ScifiThemeId = typeof SCIFI_THEME_OPTION.id;
export declare const SCIFI_DARK_CSS_VARS: Record<string, string>;
export declare const THEME_OPTIONS: readonly [{
    readonly id: "dark";
    readonly label: "深色";
    readonly icon: "🌙";
}, {
    readonly id: "light";
    readonly label: "浅色";
    readonly icon: "☀️";
}, {
    id: "scifi-dark";
    label: string;
    icon: string;
}];
export type ExtendedThemeMode = 'dark' | 'light' | 'scifi-dark';
//# sourceMappingURL=patch-theme-switch.d.ts.map