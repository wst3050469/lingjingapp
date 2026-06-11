/**
 * 灵境 Cloud Server — 实时日志流模块
 * 拦截 console.log/error/warn，广播给 SSE 订阅者
 */

// SSE subscribers
const subscribers = new Set();
let originalConsole = null;
let patched = false;

// Buffer: keep last 200 log entries for new subscribers
const logBuffer = [];
const MAX_BUFFER = 200;

function emitLog(entry) {
  const data = JSON.stringify(entry);
  for (const send of subscribers) {
    try { send(data); } catch (e) { /* ignore */ }
  }
  // Buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
}

function patchConsole() {
  if (patched) return;
  patched = true;
  
  originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  console.log = function(...args) {
    originalConsole.log.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    emitLog({ type: 'log', timestamp: new Date().toISOString(), message, source: 'server' });
  };

  console.error = function(...args) {
    originalConsole.error.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    emitLog({ type: 'error', timestamp: new Date().toISOString(), message, source: 'server' });
  };

  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    emitLog({ type: 'warn', timestamp: new Date().toISOString(), message, source: 'server' });
  };

  console.info = function(...args) {
    originalConsole.info.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    emitLog({ type: 'info', timestamp: new Date().toISOString(), message, source: 'server' });
  };
}

function unpatchConsole() {
  if (!patched) return;
  patched = false;
  if (originalConsole) {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    originalConsole = null;
  }
}

export function subscribe(sendFn) {
  subscribers.add(sendFn);
  if (!patched) patchConsole();
  // Send buffer on subscribe
  logBuffer.forEach(entry => {
    try { sendFn(JSON.stringify(entry)); } catch (e) { /* ignore */ }
  });
  return () => {
    subscribers.delete(sendFn);
    if (subscribers.size === 0) unpatchConsole();
  };
}

export function getSubscriberCount() {
  return subscribers.size;
}

export function getBuffer() {
  return [...logBuffer];
}
