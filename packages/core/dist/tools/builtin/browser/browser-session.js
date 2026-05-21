let _browserExecutor = null;
export function initBrowserTools(executor) {
    _browserExecutor = executor;
}
export function getBrowserExecutor() {
    return _browserExecutor;
}
export function isBrowserInitialized() {
    return _browserExecutor !== null;
}
//# sourceMappingURL=browser-session.js.map