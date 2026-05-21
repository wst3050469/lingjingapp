export function ipcOk(data) {
    return { success: true, data };
}
export function ipcFail(error, errorCategory = 'unknown') {
    return { success: false, error, errorCategory };
}
export function isIpcOk(result) {
    return result.success === true;
}
export function isIpcFail(result) {
    return result.success === false;
}
//# sourceMappingURL=types.js.map