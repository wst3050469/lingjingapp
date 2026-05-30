// MCP Installer service - handles MCP server installation from marketplace
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

interface InstallOptions {
  name: string;
  version: string;
  source: string;
  platform: string[];
}

interface InstallResult {
  success: boolean;
  error?: string;
  installPath?: string;
}

type ProgressCallback = (progress: { percent: number; message: string }) => void;

export class MCPInstaller {
  private installDir: string;
  private cancelled = new Set<string>();

  constructor() {
    this.installDir = join(homedir(), '.lingjing', 'mcp-servers');
  }

  getInstallDir(): string {
    return this.installDir;
  }

  cancel(name: string): boolean {
    this.cancelled.add(name);
    return true;
  }

  isCancelled(name: string): boolean {
    return this.cancelled.has(name);
  }

  async install(options: InstallOptions, onProgress?: ProgressCallback): Promise<InstallResult> {
    const { name, version, source } = options;

    if (this.cancelled.has(name)) {
      this.cancelled.delete(name);
      return { success: false, error: '安装已取消' };
    }

    // Ensure install directory exists
    if (!existsSync(this.installDir)) {
      mkdirSync(this.installDir, { recursive: true });
    }

    const installPath = join(this.installDir, name);

    try {
      // MCP service installation logic:
      // For built-in servers: copy from bundled resources
      // For npx-based servers: install via npm/pnpm
      if (source === 'built-in') {
        onProgress?.({ percent: 50, message: `正在安装内置服务 ${name}...` });
        // Built-in servers are pre-installed in the app bundle
        return {
          success: true,
          installPath,
        };
      }

      if (source === 'npx' || source === 'npm') {
        onProgress?.({ percent: 30, message: `正在从 ${source} 安装 ${name}@${version}...` });
        // For npx/npm servers, the actual install happens at runtime via npx
        // We just ensure the directory exists
        return {
          success: true,
          installPath,
        };
      }

      return {
        success: false,
        error: `不支持的安装源: ${source}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `安装失败: ${message}`,
      };
    }
  }
}
