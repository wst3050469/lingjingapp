// 缺失的 npm 模块类型声明
declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string, options?: any): any;
  export function decode(token: string, options?: any): any;
}

declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): QueryResult[];
    prepare(sql: string): Statement;
    close(): void;
    export(): Uint8Array;
  }
  interface QueryResult {
    columns: string[];
    values: any[][];
  }
  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(...params: any[]): any;
    getAsObject(params?: any): Record<string, any>;
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    all(...params: any[]): any[];
    free(): boolean;
  }
  export function locateFile(file: string): string;
  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}

declare module 'adm-zip' {
  class AdmZip {
    constructor(path?: string | Buffer);
    addFile(name: string, data: Buffer): void;
    addLocalFile(path: string): void;
    extractAllTo(path: string, overwrite?: boolean): void;
    extractEntryTo(entryPath: string, targetPath: string, maintainEntryPath?: boolean, overwrite?: boolean): void;
    getEntries(): IZipEntry[];
    getEntry(entryName: string): IZipEntry | null;
    readAsText(entry: IZipEntry): string;
    toBuffer(): Buffer;
  }
  interface IZipEntry {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  }
  export default AdmZip;
}

declare module 'ssh2' {
  import { EventEmitter } from 'events';

  export class Client extends EventEmitter {
    connect(config: ConnectConfig): void;
    end(): void;
    exec(command: string, options?: any, callback?: (err: any, stream: ClientChannel) => void): void;
    exec(command: string, callback?: (err: any, stream: ClientChannel) => void): void;
    sftp(callback: (err: any, sftp: SFTPWrapper) => void): void;
    shell(options?: any, callback?: (err: any, stream: ClientChannel) => void): void;
  }

  export interface ConnectConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string | Buffer;
    readyTimeout?: number;
    keepaliveInterval?: number;
    keepaliveCountMax?: number;
  }

  export class ClientChannel extends EventEmitter {
    setWindow(rows: number, cols: number, height: number, width: number): void;
    signal(name: string): void;
    exit(name: string, coreDumped: boolean, msg: string): void;
    stderr: import('stream').Readable;
    write(data: string | Buffer, encoding?: string, callback?: (err?: Error) => void): void;
    end(): void;
  }

  export class SFTPWrapper extends EventEmitter {
    readdir(path: string, callback: (err: any, list: any[]) => void): void;
    readFile(path: string, options: any, callback: (err: any, data: Buffer) => void): void;
    readFile(path: string, callback: (err: any, data: Buffer) => void): void;
    writeFile(path: string, data: Buffer, callback?: (err: any) => void): void;
    mkdir(path: string, attributes?: any, callback?: (err: any) => void): void;
    rmdir(path: string, callback?: (err: any) => void): void;
    unlink(path: string, callback?: (err: any) => void): void;
    rename(oldPath: string, newPath: string, callback?: (err: any) => void): void;
    stat(path: string, callback: (err: any, stats: any) => void): void;
    fastGet(remotePath: string, localPath: string, options?: any, callback?: (err: any) => void): void;
    fastPut(localPath: string, remotePath: string, options?: any, callback?: (err: any) => void): void;
    end(): void;
  }

  export type TransferOptions = {
    concurrency?: number;
    chunkSize?: number;
    step?: (totalTransferred: number, chunk: number, total: number) => void;
  };
}

declare module 'express' {
  import { Server, IncomingMessage, ServerResponse } from 'http';

  interface Express {
    (req: IncomingMessage, res: ServerResponse, next?: (err?: any) => void): void;
    use(path: string | RegExp | (string | RegExp)[] | Handler, handler?: Handler): Express;
    use(handler: Handler): Express;
    get(path: string | RegExp | (string | RegExp)[], ...handlers: Handler[]): Express;
    post(path: string | RegExp | (string | RegExp)[], ...handlers: Handler[]): Express;
    put(path: string | RegExp | (string | RegExp)[], ...handlers: Handler[]): Express;
    delete(path: string | RegExp | (string | RegExp)[], ...handlers: Handler[]): Express;
    listen(port: number, callback?: () => void): Server;
  }

  interface Request extends IncomingMessage {
    params: Record<string, string>;
    query: Record<string, string | string[]>;
    body?: any;
  }

  interface Response extends ServerResponse {
    status(code: number): Response;
    json(data: any): void;
    send(data: any): void;
    sendFile(path: string, options?: any, callback?: (err?: Error) => void): void;
    sendStatus(code: number): void;
    set(field: string, value: string): Response;
    header(field: string, value: string): Response;
    type(type: string): Response;
  }

  type NextFunction = (err?: any) => void;
  type Handler = (req: Request, res: Response, next: NextFunction) => void;

  interface ExpressStatic {
    (): Express;
    static(path: string, options?: any): Handler;
    json(): Handler;
    urlencoded(options?: { extended: boolean }): Handler;
  }

  const express: ExpressStatic;
  export default express;
  export { Express, Request, Response, NextFunction, Handler };
}

declare module 'ws' {
  import { EventEmitter } from 'events';
  import { Server as HttpServer } from 'http';

  class WebSocket extends EventEmitter {
    constructor(url: string, options?: any);
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'open', listener: () => void): this;
    static readonly OPEN: number;
    static readonly CONNECTING: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;
    readyState: number;
  }

  class WebSocketServer {
    constructor(options: { server?: HttpServer; port?: number; path?: string });
    on(event: 'connection', listener: (ws: WebSocket, req: import('http').IncomingMessage) => void): this;
    close(callback?: () => void): void;
  }

  export { WebSocketServer };
  export default WebSocket;
}

// Web Speech API 类型声明
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare var SpeechRecognition: {
  new(): SpeechRecognition;
  prototype: SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new(): SpeechRecognition;
  prototype: SpeechRecognition;
};

// axios 类型声明
declare module 'axios' {
  // 确保 InternalAxiosRequestConfig 有 metadata 属性
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
      endTime?: number;
    };
  }

  // 导出 axios 使用的类型 - 全部 any 避免类型冲突
  export type Method = string;
  export type AxiosInstance = import('axios').Axios;
  export type AxiosRequestConfig = Record<string, any>;
  export type AxiosResponse<T = any> = { data: T; status: number; statusText: string; headers: any; config: any };
  export type AxiosError<T = any> = Error & { response?: AxiosResponse<T>; config?: any; code?: string };

  class Axios {
    create(config?: Record<string, any>): AxiosInstance;
    request<T = any>(config: Record<string, any>): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: Record<string, any>): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: Record<string, any>): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: Record<string, any>): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: Record<string, any>): Promise<AxiosResponse<T>>;
    interceptors: any;
    defaults: Record<string, any>;
  }

  const axios: Axios;
  export default axios;
}

// vitest 类型声明
declare module 'vitest' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: any): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeDefined(): void;
    toBeNull(): void;
    toContain(item: any): void;
    toHaveLength(expected: number): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toMatch(expected: RegExp | string): void;
    toThrow(expected?: any): void;
    not: {
      toBe(expected: any): void;
      toEqual(expected: any): void;
    };
  };
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export const vi: {
    fn(impl?: (...args: any[]) => any): any;
    mock(path: string, factory?: () => any): void;
  };
}
