export declare const SCIFI_THEME_OPTION: {
    readonly id: "scifi-dark";
    label: string;
    icon: string;
};
export declare type ScifiThemeId = typeof SCIFI_THEME_OPTION.id;
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
    readonly id: "scifi-dark";
    label: string;
    icon: string;
}];
export declare type ExtendedThemeMode = 'dark' | 'light' | 'scifi-dark';
