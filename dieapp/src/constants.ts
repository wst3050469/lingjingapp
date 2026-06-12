// 灵境 Cloud Server 配置
export const CLOUD_SERVER_URL = 'https://ide.zhejiangjinmo.com';
export const CLOUD_SERVER_WS = 'wss://ide.zhejiangjinmo.com/ws';
export const APP_NAME = '灵境 AI 编程助手';
export const APP_VERSION = '1.73.36';

// 字体系统
export const FontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32, title: 28,
} as const;

// 圆角系统
export const BorderRadius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 9999,
} as const;

// 间距系统
export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

// 灵境 API 端点
export const API = {
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  VERIFY_TOKEN: '/api/auth/verify',
  SMS_SEND: '/api/auth/sms/send',
  SMS_LOGIN: '/api/auth/sms/login',
  ENTERPRISE_SSO: '/api/auth/enterprise/sso',
  DELETE_ACCOUNT: '/api/auth/delete',
  DELETE_ACCOUNT_SEND_CODE: '/api/auth/delete/send-code',
  USER_PROFILE: '/api/user/profile',
  UPDATE_PROFILE: '/api/user/profile/update',
  SESSIONS: '/api/sessions',
  SESSIONS_ACTIVE: '/api/sessions/active',
  SESSIONS_ARCHIVE: '/api/sessions/archive',
  CONVERSATIONS: '/api/conversations',
  TASKS: '/api/tasks',
  USAGE: '/api/usage',
  FEEDBACK: '/api/feedback',
  CHECK_UPDATE: '/api/latest',
  NOTIFICATIONS: '/api/notifications',
} as const;

// 颜色常量（对齐 qoder.apk 设计）
export const Colors = {
  // 深色主题
  dark: {
    bg: '#0d1117',
    surface: '#161b22',
    surface2: '#21262d',
    border: '#30363d',
    text: '#c9d1d9',
    textSecondary: '#8b949e',
    textTertiary: '#6e7681',
    primary: '#58a6ff',
    primaryBg: 'rgba(88,166,255,0.1)',
    success: '#3fb950',
    successBg: 'rgba(63,185,80,0.1)',
    warning: '#d29922',
    warningBg: 'rgba(210,153,34,0.1)',
    danger: '#f85149',
    dangerBg: 'rgba(248,81,73,0.1)',
    purple: '#a371f7',
    purpleBg: 'rgba(163,113,247,0.1)',
    orange: '#f0883e',
    orangeBg: 'rgba(240,136,62,0.1)',
    teal: '#39c5cf',
    tealBg: 'rgba(57,197,207,0.1)',
    white: '#ffffff',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.5)',
  },
  // 浅色主题
  light: {
    bg: '#ffffff',
    surface: '#f6f8fa',
    surface2: '#eaeef2',
    border: '#d0d7de',
    text: '#1f2328',
    textSecondary: '#656d76',
    textTertiary: '#8b949e',
    primary: '#0969da',
    primaryBg: 'rgba(9,105,218,0.08)',
    success: '#1a7f37',
    successBg: 'rgba(26,127,55,0.08)',
    warning: '#9a6700',
    warningBg: 'rgba(154,103,0,0.08)',
    danger: '#cf222e',
    dangerBg: 'rgba(207,34,46,0.08)',
    purple: '#8250df',
    purpleBg: 'rgba(130,80,223,0.08)',
    orange: '#d4700a',
    orangeBg: 'rgba(212,112,10,0.08)',
    teal: '#0a8d96',
    tealBg: 'rgba(10,141,150,0.08)',
    white: '#ffffff',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.4)',
  },
} as const;
