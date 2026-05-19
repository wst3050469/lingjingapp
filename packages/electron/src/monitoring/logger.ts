// Logger module - provides createLogger factory for IPC modules
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
}

export function createLogger(prefix: string): Logger {
  const fmt = (level: LogLevel, msg: string, args: unknown[]): string => {
    const ts = new Date().toISOString();
    const extra = args.length ? ' ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') : '';
    return `[${ts}] [${level.toUpperCase()}] [${prefix}] ${msg}${extra}`;
  };

  return {
    info(msg: string, ...args: unknown[]): void { console.info(fmt('info', msg, args)); },
    warn(msg: string, ...args: unknown[]): void { console.warn(fmt('warn', msg, args)); },
    error(msg: string, ...args: unknown[]): void { console.error(fmt('error', msg, args)); },
    debug(msg: string, ...args: unknown[]): void { console.debug(fmt('debug', msg, args)); },
  };
}
