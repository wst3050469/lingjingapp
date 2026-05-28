"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env.LOG_LEVEL || 'info';
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
}
exports.logger = {
    debug(...args) {
        if (shouldLog('debug'))
            console.debug(formatMessage('debug', ...args));
    },
    info(...args) {
        if (shouldLog('info'))
            console.info(formatMessage('info', ...args));
    },
    warn(...args) {
        if (shouldLog('warn'))
            console.warn(formatMessage('warn', ...args));
    },
    error(...args) {
        if (shouldLog('error'))
            console.error(formatMessage('error', ...args));
    },
};
//# sourceMappingURL=logger.js.map