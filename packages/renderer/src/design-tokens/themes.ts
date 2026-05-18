import { colors } from './index';

export interface Theme {
  name: string;
  type: 'light' | 'dark';
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    border: string;
    borderFocus: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    primary: string;
    primaryHover: string;
    primaryActive: string;
    success: string;
    error: string;
    warning: string;
    info: string;
  };
}

export const darkTheme: Theme = {
  name: 'dark',
  type: 'dark',
  colors: {
    background: colors.neutral[900],
    backgroundSecondary: colors.neutral[800],
    backgroundTertiary: colors.neutral[700],
    surface: '#252526',
    surfaceHover: '#2d2d2d',
    surfaceActive: '#3c3c3c',
    border: colors.neutral[700],
    borderFocus: colors.primary[500],
    text: colors.neutral[0],
    textSecondary: colors.neutral[400],
    textTertiary: colors.neutral[500],
    textInverse: colors.neutral[900],
    primary: colors.primary[500],
    primaryHover: colors.primary[400],
    primaryActive: colors.primary[600],
    success: colors.success.dark,
    error: colors.error.dark,
    warning: colors.warning.dark,
    info: colors.info.dark,
  },
};

export const lightTheme: Theme = {
  name: 'light',
  type: 'light',
  colors: {
    background: colors.neutral[0],
    backgroundSecondary: colors.neutral[50],
    backgroundTertiary: colors.neutral[100],
    surface: colors.neutral[0],
    surfaceHover: colors.neutral[100],
    surfaceActive: colors.neutral[200],
    border: colors.neutral[200],
    borderFocus: colors.primary[500],
    text: colors.neutral[900],
    textSecondary: colors.neutral[600],
    textTertiary: colors.neutral[500],
    textInverse: colors.neutral[0],
    primary: colors.primary[500],
    primaryHover: colors.primary[600],
    primaryActive: colors.primary[700],
    success: colors.success.light,
    error: colors.error.light,
    warning: colors.warning.light,
    info: colors.info.light,
  },
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeName = keyof typeof themes;
