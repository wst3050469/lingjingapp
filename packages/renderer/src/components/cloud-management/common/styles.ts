export const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: '#f0f7ff',
      100: '#e0effe',
      200: '#bae0fd',
      300: '#7cccfb',
      400: '#36b6f0',
      500: '#0c96e9',
      600: '#0078d4',
      700: '#006cbd',
      800: '#005ba1',
      900: '#00437a',
    },
    neutral: {
      0: '#ffffff',
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712',
    },
    success: {
      light: '#10b981',
      dark: '#34d399',
    },
    error: {
      light: '#ef4444',
      dark: '#f87171',
    },
    warning: {
      light: '#f59e0b',
      dark: '#fbbf24',
    },
    info: {
      light: '#3b82f6',
      dark: '#60a5fa',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const COMPONENT_STYLES = {
  card: {
    base: 'bg-white/[0.03] border border-white/10 backdrop-blur-sm',
    hover: 'hover:bg-white/[0.05] hover:border-white/20',
    padding: 'p-6',
    rounded: 'rounded-xl',
  },
  button: {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    secondary: 'bg-white/10 text-white hover:bg-white/20 active:bg-white/30',
    ghost: 'text-white/70 hover:text-white hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  },
  input: {
    base: 'bg-white/5 border border-white/10 text-white placeholder-white/40',
    focus: 'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
  },
  badge: {
    base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/20 text-blue-400',
  },
} as const;
