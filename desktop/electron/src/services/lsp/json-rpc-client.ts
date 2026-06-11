// JSON-RPC 2.0 client over stdio for LSP communication
// Handles Content-Length header framing and request/response correlation

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class JsonRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (result: unknown) => void; reject: (err: Error) => void }>();
  private buffer = '';
  private contentLength = -1;
  private command: string;
  private args: string[];
  private cwd?: string;

  constructor(command: string, args: string[] = [], cwd?: string) {
    super();
    this.command = command;
    this.args = args;
    this.cwd = cwd;
  }

  /** Start the language server process */
  start(): void {
    if (this.process) return;

    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.cwd,
      shell: process.platform === 'win32',
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleData(data.toString('utf8'));
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      // LSP servers may log to stderr — just emit for debugging
      this.emit('stderr', data.toString('utf8'));
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
      this.cleanup();
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
      this.cleanup();
    });
  }

  /** Send a JSON-RPC request and wait for response */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.process?.stdin?.writable) {
      throw new Error('JSON-RPC client not connected');
    }

    const id = this.nextId++;
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`JSON-RPC request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /** Send a JSON-RPC notification (no response expected) */
  notify(method: string, params?: unknown): void {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.send(message);
  }

  /** Stop the language server process gracefully */
  async stop(): Promise<void> {
    if (!this.process) return;

    try {
      // Send shutdown request then exit notification
      await this.request('shutdown', null);
      this.notify('exit');
    } catch {
      // Force kill if shutdown fails
    }

    // Give it a moment then force kill
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 3000);

      this.process?.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.cleanup();
  }

  /** Check if the process is running */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  // --- Private methods ---

  private send(message: JsonRpcMessage): void {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.process?.stdin?.write(header + json, 'utf8');
  }

  /** Parse incoming data with Content-Length header framing */
  private handleData(chunk: string): void {
    this.buffer += chunk;

    while (true) {
      if (this.contentLength === -1) {
        // Look for header
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return; // Need more data

        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Invalid header, skip
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1], 10);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      // Check if we have enough data for the body
      if (Buffer.byteLength(this.buffer, 'utf8') < this.contentLength) {
        return; // Need more data
      }

      // Extract the body
      const bodyBytes = Buffer.from(this.buffer, 'utf8').slice(0, this.contentLength);
      const body = bodyBytes.toString('utf8');
      this.buffer = Buffer.from(this.buffer, 'utf8').slice(this.contentLength).toString('utf8');
      this.contentLength = -1;

      try {
        const message = JSON.parse(body) as JsonRpcMessage;
        this.handleMessage(message);
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined && message.id !== null) {
      // Response to a request
      const pending = this.pending.get(message.id as number);
      if (pending) {
        this.pending.delete(message.id as number);
        if (message.error) {
          pending.reject(new Error(`${message.error.message} (code: ${message.error.code})`));
        } else {
          pending.resolve(message.result);
        }
        return;
      }
    }

    // Notification from server
    if (message.method) {
      this.emit('notification', message.method, message.params);
    }
  }

  private cleanup(): void {
    // Reject all pending requests
    for (const [, { reject }] of this.pending) {
      reject(new Error('JSON-RPC client disconnected'));
    }
    this.pending.clear();
    this.process = null;
    this.buffer = '';
    this.contentLength = -1;
  }
}
