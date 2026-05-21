export type ErrorCategory = 'spawn' | 'timeout' | 'protocol' | 'network' | 'auth' | 'validation' | 'rate-limit' | 'url-encoding' | 'http-404' | 'http-5xx' | 'hash-mismatch' | 'server-unreachable' | 'check-timeout' | 'unknown';
export interface IpcSuccess<T> {
    success: true;
    data: T;
}
export interface IpcFailure {
    success: false;
    error: string;
    errorCategory: ErrorCategory;
}
export type IpcResult<T> = IpcSuccess<T> | IpcFailure;
export declare function ipcOk<T>(data: T): IpcSuccess<T>;
export declare function ipcFail(error: string, errorCategory?: ErrorCategory): IpcFailure;
export declare function isIpcOk<T>(result: IpcResult<T>): result is IpcSuccess<T>;
export declare function isIpcFail<T>(result: IpcResult<T>): result is IpcFailure;
//# sourceMappingURL=types.d.ts.map