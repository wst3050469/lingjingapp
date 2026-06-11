// LSP Manager - manages language server lifecycle per workspace
// Detects project type, lazily starts appropriate language server,
// handles crash restarts, and provides diagnostics access

import { LspClient, type LspDiagnostic, type DiagnosticEntry, severityToString } from './lsp-client.js';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { EventEmitter } from 'node:events';

interface ServerConfig {
  name: string;
  command: string;
  args: string[];
  extensions: string[];
  detectFiles: string[];  // Files that indicate this server is needed
}

// Known language server configurations
const SERVER_CONFIGS: ServerConfig[] = [
  {
    name: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    detectFiles: ['tsconfig.json', 'jsconfig.json', 'package.json'],
  },
  {
    name: 'python',
    command: 'pyright-langserver',
    args: ['--stdio'],
    extensions: ['.py', '.pyi'],
    detectFiles: ['pyrightconfig.json', 'pyproject.toml', 'setup.py', 'requirements.txt'],
  },
];

const MAX_RESTARTS = 3;

export class LspManager extends EventEmitter {
  private clients = new Map<string, LspClient>();  // serverName -> client
  private restartCounts = new Map<string, number>();
  private workspace: string = '';

  /** Set the workspace root directory */
  setWorkspace(workspace: string): void {
    this.workspace = workspace;
  }

  /** Get diagnostics for a specific file */
  async getDiagnostics(filePath: string, severity?: string): Promise<string> {
    if (!this.workspace) {
      return 'No workspace set.';
    }

    const ext = extname(filePath).toLowerCase();
    const config = this.findServerForExtension(ext);

    if (!config) {
      return `No language server available for ${ext} files.`;
    }

    // Ensure the server is running
    const client = await this.ensureServer(config);
    if (!client) {
      return `Language server "${config.name}" is not available. Make sure "${config.command}" is installed and accessible in PATH.`;
    }

    try {
      const diagnostics = await client.requestDiagnostics(filePath);
      return this.formatDiagnostics(filePath, diagnostics, severity);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error getting diagnostics: ${msg}`;
    }
  }

  /** Get diagnostics for all open/known files in the workspace */
  async getProjectDiagnostics(severity?: string): Promise<string> {
    if (!this.workspace) {
      return 'No workspace set.';
    }

    const results: string[] = [];

    for (const [, client] of this.clients) {
      const entries = client.getAllDiagnostics();
      for (const entry of entries) {
        const formatted = this.formatDiagnostics(entry.filePath, entry.diagnostics, severity);
        if (formatted) {
          results.push(formatted);
        }
      }
    }

    if (results.length === 0) {
      return 'No diagnostics available. Open specific files to get their diagnostics.';
    }

    return results.join('\n');
  }

  /** Shutdown all language servers */
  async shutdownAll(): Promise<void> {
    const shutdowns = Array.from(this.clients.values()).map(client => {
      return client.shutdown().catch(() => {});
    });
    await Promise.all(shutdowns);
    this.clients.clear();
    this.restartCounts.clear();
  }

  /** Check which servers are available */
  async checkAvailability(): Promise<Array<{ name: string; available: boolean }>> {
    const results: Array<{ name: string; available: boolean }> = [];

    for (const config of SERVER_CONFIGS) {
      const hasProject = config.detectFiles.some(f => existsSync(join(this.workspace, f)));
      if (hasProject) {
        const available = await this.isCommandAvailable(config.command);
        results.push({ name: config.name, available });
      }
    }

    return results;
  }

  // --- Private ---

  private findServerForExtension(ext: string): ServerConfig | undefined {
    return SERVER_CONFIGS.find(c => c.extensions.includes(ext));
  }

  private async ensureServer(config: ServerConfig): Promise<LspClient | null> {
    const existing = this.clients.get(config.name);
    if (existing?.isRunning()) {
      return existing;
    }

    // Check if command is available
    const available = await this.isCommandAvailable(config.command);
    if (!available) {
      return null;
    }

    // Check restart limit
    const restarts = this.restartCounts.get(config.name) ?? 0;
    if (restarts >= MAX_RESTARTS) {
      console.error(`LSP server "${config.name}" exceeded max restarts (${MAX_RESTARTS})`);
      return null;
    }

    return this.startServer(config);
  }

  private async startServer(config: ServerConfig): Promise<LspClient | null> {
    try {
      const client = new LspClient(config.command, config.args, this.workspace, config.name);

      client.on('exit', (code: number) => {
        console.log(`LSP server "${config.name}" exited with code ${code}`);
        this.clients.delete(config.name);

        // Increment restart counter
        const count = (this.restartCounts.get(config.name) ?? 0) + 1;
        this.restartCounts.set(config.name, count);
      });

      client.on('diagnostics', (uri: string, diagnostics: LspDiagnostic[]) => {
        this.emit('diagnostics', config.name, uri, diagnostics);
      });

      client.on('error', (err: Error) => {
        console.error(`LSP server "${config.name}" error:`, err.message);
      });

      await client.initialize();
      this.clients.set(config.name, client);
      console.log(`LSP server "${config.name}" initialized`);

      return client;
    } catch (err) {
      console.error(`Failed to start LSP server "${config.name}":`, err);
      return null;
    }
  }

  private async isCommandAvailable(command: string): Promise<boolean> {
    const { exec } = await import('node:child_process');
    return new Promise<boolean>((resolve) => {
      const checkCmd = process.platform === 'win32'
        ? `where ${command}`
        : `which ${command}`;
      exec(checkCmd, (err) => {
        resolve(!err);
      });
    });
  }

  private formatDiagnostics(
    filePath: string,
    diagnostics: LspDiagnostic[],
    severityFilter?: string,
  ): string {
    let filtered = diagnostics;

    if (severityFilter && severityFilter !== 'all') {
      const targetSev = severityFilter === 'error' ? 1 : severityFilter === 'warning' ? 2 : 0;
      if (targetSev > 0) {
        filtered = diagnostics.filter(d => (d.severity ?? 1) <= targetSev);
      }
    }

    if (filtered.length === 0) {
      return '';
    }

    const lines: string[] = [];
    for (const d of filtered) {
      const sev = severityToString(d.severity);
      const line = d.range.start.line + 1;
      const col = d.range.start.character + 1;
      const source = d.source ? `${d.source}: ` : '';
      const code = d.code ? ` ${d.code}` : '';
      lines.push(`${filePath}:${line}:${col} ${sev}${code}: ${source}${d.message}`);
    }

    return lines.join('\n');
  }
}

// Singleton
export const lspManager = new LspManager();
