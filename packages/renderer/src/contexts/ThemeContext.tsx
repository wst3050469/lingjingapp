import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Theme, ThemeName, themes, darkTheme } from '../design-tokens/themes';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'lingjing-theme';

function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (stored === 'dark' || stored === 'light')) {
    return stored;
  }
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>(getInitialTheme);
  
  const theme = themes[themeName];
  
  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem(STORAGE_KEY, name);
  }, []);
  
  const toggleTheme = useCallback(() => {
    const newTheme = themeName === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [themeName, setTheme]);
  
  useEffect(() => {
    const root = document.documentElement;
    
    if (themeName === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Set cp-* CSS variables for tailwind color tokens
    const cpVars = themeName === 'light'
      ? {
          '--cp-bg': '#ffffff',
          '--cp-sidebar': '#f3f4f6',
          '--cp-editor': '#ffffff',
          '--cp-panel': '#ffffff',
          '--cp-statusbar': '#007acc',
          '--cp-activitybar': '#e5e7eb',
          '--cp-tab-active': '#ffffff',
          '--cp-tab-inactive': '#f9fafb',
          '--cp-border': '#e5e7eb',
          '--cp-text': '#1a1a1a',
          '--cp-text-dim': '#6b7280',
          '--cp-accent': '#007acc',
          '--cp-success': '#059669',
          '--cp-error': '#dc2626',
          '--cp-warning': '#d97706',
          '--cp-info': '#2563eb',
        }
      : {
          '--cp-bg': '#1e1e1e',
          '--cp-sidebar': '#252526',
          '--cp-editor': '#1e1e1e',
          '--cp-panel': '#1e1e1e',
          '--cp-statusbar': '#007acc',
          '--cp-activitybar': '#333333',
          '--cp-tab-active': '#1e1e1e',
          '--cp-tab-inactive': '#2d2d2d',
          '--cp-border': '#3c3c3c',
          '--cp-text': '#ffffff',
          '--cp-text-dim': '#b0b0b0',
          '--cp-accent': '#007acc',
          '--cp-success': '#4ec9b0',
          '--cp-error': '#f44747',
          '--cp-warning': '#cca700',
          '--cp-info': '#3794ff',
        };
    Object.entries(cpVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme, themeName]);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setThemeName(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { themes, darkTheme };
export type { Theme, ThemeName };
