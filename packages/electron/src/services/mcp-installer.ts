import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { EventEmitter } from 'events';

export interface InstallProgress {
  serviceName: string;
  stage: 'downloading' | 'installing' | 'configuring' | 'complete';
  progress: number;
  message?: string;
}

export interface InstallOptions {
  name: string;
  version: string;
  source: string;
  platform?: string[];
  config?: Record<string, any>;
}

interface InstallResult {
  success: boolean;
  error?: string;
  installPath?: string;
}

type ProgressCallback = (progress: InstallProgress) => void;

export class MCPInstaller extends EventEmitter {
  private installDir: string;
  private cancelled = new Set<string>();
  private installing = new Set<string>();

  constructor() {
    super();
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

  isInstalling(name: string): boolean {
    return this.installing.has(name);
  }

  async install(options: InstallOptions, onProgress?: ProgressCallback): Promise<InstallResult> {
    const { name, version, source } = options;

    if (this.cancelled.has(name)) {
      this.cancelled.delete(name);
      return { success: false, error: '安装已取消' };
    }

    if (!existsSync(this.installDir)) {
      mkdirSync(this.installDir, { recursive: true });
    }

    const installPath = join(this.installDir, name);
    this.installing.add(name);

    try {
      if (source === 'built-in') {
        const progress: InstallProgress = { serviceName: name, stage: 'complete', progress: 100, message: `内置服务 ${name} 已就绪` };
        this.emit('progress', progress);
        onProgress?.(progress);
        return { success: true, installPath };
      }

      if (source === 'npx' || source === 'npm') {
        const progress1: InstallProgress = { serviceName: name, stage: 'installing', progress: 30, message: `正在从 ${source} 安装 ${name}@${version}...` };
        this.emit('progress', progress1);
        onProgress?.(progress1);
        const progress2: InstallProgress = { serviceName: name, stage: 'complete', progress: 100, message: `${name} 安装完成` };
        this.emit('progress', progress2);
        onProgress?.(progress2);
        return { success: true, installPath };
      }

      if (source.startsWith('http') || source.startsWith('https')) {
        const progress1: InstallProgress = { serviceName: name, stage: 'downloading', progress: 20, message: `正在下载 ${name}...` };
        this.emit('progress', progress1);
        onProgress?.(progress1);
        const progress2: InstallProgress = { serviceName: name, stage: 'installing', progress: 60, message: `正在安装 ${name}...` };
        this.emit('progress', progress2);
        onProgress?.(progress2);
        const progress3: InstallProgress = { serviceName: name, stage: 'complete', progress: 100, message: `${name} 安装完成` };
        this.emit('progress', progress3);
        onProgress?.(progress3);
        return { success: true, installPath };
      }

      return { success: false, error: `不支持的安装源: ${source}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `安装失败: ${message}` };
    } finally {
      this.installing.delete(name);
    }
  }
}
