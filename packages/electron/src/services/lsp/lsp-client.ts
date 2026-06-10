// LSP Client - Language Server Protocol layer on top of JSON-RPC
// Handles LSP lifecycle, diagnostics caching, and document synchronization

import { JsonRpcClient } from './json-rpc-client.js';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// LSP types (minimal subset)

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number; // 1=Error, 2=Warning, 3=Info, 4=Hint
  code?: number | string;
  source?: string;
  message: string;
}

export interface DiagnosticEntry {
  filePath: string;
  diagnostics: LspDiagnostic[];
}

const SEVERITY_MAP: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
};

export function severityToString(severity?: number): string {
  return SEVERITY_MAP[severity ?? 1] ?? 'error';
}

export class LspClient extends EventEmitter {
  private rpc: JsonRpcClient;
  private initialized = false;
  private rootUri: string;
  private diagnosticsCache = new Map<string, LspDiagnostic[]>();
  private openedFiles = new Set<string>();
  private serverName: string;

  constructor(command: string, args: string[], rootPath: string, serverName: string) {
    super();
    this.rpc = new JsonRpcClient(command, args, rootPath);
    this.rootUri = pathToFileURL(rootPath).toString();
    this.serverName = serverName;

    // Listen for server notifications
    this.rpc.on('notification', (method: string, params: unknown) => {
      if (method === 'textDocument/publishDiagnostics') {
        this.handleDiagnostics(params as { uri: string; diagnostics: LspDiagnostic[] });
      }
    });

    this.rpc.on('exit', (code: number) => {
      this.initialized = false;
      this.emit('exit', code);
    });

    this.rpc.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  get name(): string {
    return this.serverName;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Initialize the LSP server */
  async initialize(): Promise<void> {
    this.rpc.start();

    const initResult = await this.rpc.request('initialize', {
      processId: process.pid,
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true,
          },
          synchronization: {
            didOpen: true,
            didChange: true,
            didClose: true,
          },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
      workspaceFolders: [
        { uri: this.rootUri, name: 'workspace' },
      ],
    });

    // Send initialized notification
    this.rpc.notify('initialized', {});
    this.initialized = true;
    this.emit('initialized', initResult);
  }

  /** Open a document for diagnostics */
  async openDocument(filePath: string): Promise<void> {
    if (!this.initialized) return;

    const uri = pathToFileURL(filePath).toString();
    if (this.openedFiles.has(uri)) return;

    try {
      const content = await readFile(filePath, 'utf8');
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      const languageId = this.getLanguageId(ext);

      this.rpc.notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version: 1,
          text: content,
        },
      });

      this.openedFiles.add(uri);
    } catch {
      // File read error, skip
    }
  }

  /** Close a document */
  closeDocument(filePath: string): void {
    if (!this.initialized) return;

    const uri = pathToFileURL(filePath).toString();
    if (!this.openedFiles.has(uri)) return;

    this.rpc.notify('textDocument/didClose', {
      textDocument: { uri },
    });

    this.openedFiles.delete(uri);
    this.diagnosticsCache.delete(uri);
  }

  /** Get cached diagnostics for a file */
  getDiagnostics(filePath: string): LspDiagnostic[] {
    const uri = pathToFileURL(filePath).toString();
    return this.diagnosticsCache.get(uri) ?? [];
  }

  /** Get all cached diagnostics */
  getAllDiagnostics(): DiagnosticEntry[] {
    const entries: DiagnosticEntry[] = [];
    for (const [uri, diagnostics] of this.diagnosticsCache) {
      if (diagnostics.length > 0) {
        // Convert URI back to file path
        let filePath: string;
        try {
          filePath = new URL(uri).pathname;
          // Windows: remove leading slash from /C:/path
          if (process.platform === 'win32' && filePath.startsWith('/')) {
            filePath = filePath.slice(1);
          }
          filePath = decodeURIComponent(filePath);
        } catch {
          filePath = uri;
        }
        entries.push({ filePath, diagnostics });
      }
    }
    return entries;
  }

  /** Request diagnostics for a file by opening it and waiting for publishDiagnostics */
  async requestDiagnostics(filePath: string, timeout = 10000): Promise<LspDiagnostic[]> {
    if (!this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const uri = pathToFileURL(filePath).toString();

    // Open the document if not already open
    await this.openDocument(filePath);

    // Wait for diagnostics notification
    return new Promise<LspDiagnostic[]>((resolve) => {
      // Check if we already have diagnostics
      const existing = this.diagnosticsCache.get(uri);
      if (existing !== undefined) {
        resolve(existing);
        return;
      }

      const timer = setTimeout(() => {
        this.removeListener('diagnostics', handler);
        // Return empty array on timeout (no diagnostics = no errors)
        resolve(this.diagnosticsCache.get(uri) ?? []);
      }, timeout);

      const handler = (diagUri: string) => {
        if (diagUri === uri) {
          clearTimeout(timer);
          this.removeListener('diagnostics', handler);
          resolve(this.diagnosticsCache.get(uri) ?? []);
        }
      };

      this.on('diagnostics', handler);
    });
  }

  /** Shutdown the LSP server */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Close all open documents
    for (const uri of this.openedFiles) {
      this.rpc.notify('textDocument/didClose', {
        textDocument: { uri },
      });
    }
    this.openedFiles.clear();

    try {
      await this.rpc.stop();
    } catch {
      // Ignore shutdown errors
    }
    this.initialized = false;
    this.diagnosticsCache.clear();
  }

  /** Check if running */
  isRunning(): boolean {
    return this.rpc.isRunning();
  }

  // --- Private ---

  private handleDiagnostics(params: { uri: string; diagnostics: LspDiagnostic[] }): void {
    this.diagnosticsCache.set(params.uri, params.diagnostics);
    this.emit('diagnostics', params.uri, params.diagnostics);
  }

  private getLanguageId(ext: string): string {
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescriptreact',
      js: 'javascript',
      jsx: 'javascriptreact',
      mjs: 'javascript',
      cjs: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      vue: 'vue',
      svelte: 'svelte',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
    };
    return map[ext] ?? 'plaintext';
  }
}
