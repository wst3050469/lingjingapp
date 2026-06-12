// 主题系统 - 对齐 qoder.apk 设计规范
import { useColorScheme } from 'react-native';
import { Colors } from '../constants';

export type ThemeMode = 'system' | 'dark' | 'light';
export type ThemeColors = typeof Colors.dark | typeof Colors.light;

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  spacing: typeof Spacing;
  fontSize: typeof FontSize;
  borderRadius: typeof BorderRadius;
}

// 间距系统
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// 字号系统
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 28,
} as const;

// 圆角系统
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// 获取主题
export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
}

// 工具函数：获取当前主题完整对象
export function getTheme(mode: ThemeMode = 'system'): Theme {
  const colorScheme = mode === 'system' ? 'dark' : mode;
  const isDark = colorScheme === 'dark';
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return {
    mode, colors, isDark,
    spacing: Spacing, fontSize: FontSize, borderRadius: BorderRadius,
  };
}
