type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
}

export const logger = {
  debug(...args: unknown[]): void {
    if (shouldLog('debug')) console.debug(formatMessage('debug', ...args));
  },
  info(...args: unknown[]): void {
    if (shouldLog('info')) console.info(formatMessage('info', ...args));
  },
  warn(...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(formatMessage('warn', ...args));
  },
  error(...args: unknown[]): void {
    if (shouldLog('error')) console.error(formatMessage('error', ...args));
  },
};
