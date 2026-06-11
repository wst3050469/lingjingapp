import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { HttpClient } from './http-client';
import { createHash, randomBytes } from 'crypto';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, createWriteStream, statSync, openSync, closeSync, writeSync, readFileSync } from 'fs';
import { pipeline } from 'stream/promises';

const logger = createLogger('mcp-downloader');

export interface DownloadOptions {
  url: string;
  targetPath: string;
  expectedChecksum?: string;
  chunkSize?: number;
  maxRetries?: number;
  resume?: boolean;
}

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number;
  eta: number;
}

export interface ChecksumResult {
  algorithm: string;
  hash: string;
  valid: boolean;
}

export class MCPDownloader extends EventEmitter {
  private httpClient: HttpClient;
  private activeDownloads: Map<string, AbortController>;

  constructor() {
    super();
    this.httpClient = new HttpClient({
      timeout: 120000,
      retry: {
        maxRetries: 3,
        retryDelay: 2000,
        maxRetryDelay: 10000
      }
    });
    this.activeDownloads = new Map();
  }

  async download(
    options: DownloadOptions,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const { url, targetPath, expectedChecksum, resume = true } = options;
    const downloadId = this.generateDownloadId(url);

    logger.info('Starting download', { url, targetPath, resume });

    this.ensureTargetDirectory(targetPath);

    let startByte = 0;
    if (resume && existsSync(targetPath)) {
      startByte = statSync(targetPath).size;
      logger.info('Resuming download', { startByte });
    }

    const abortController = new AbortController();
    this.activeDownloads.set(downloadId, abortController);

    try {
      const headers: Record<string, string> = {};
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      const response = await fetch(url, {
        signal: abortController.signal,
        headers
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const totalBytes = parseInt(response.headers.get('content-length') || '0', 10) + startByte;
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

      logger.debug('Download started', { totalBytes, startByte, contentLength });

      const fileStream = createWriteStream(targetPath, {
        flags: startByte > 0 ? 'a' : 'w',
        encoding: 'binary'
      });

      let bytesDownloaded = startByte;
      const startTime = Date.now();
      let lastProgressTime = startTime;
      let lastBytes = startByte;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        fileStream.write(Buffer.from(value));
        bytesDownloaded += value.length;

        const now = Date.now();
        const elapsed = (now - lastProgressTime) / 1000;

        if (elapsed >= 0.5) {
          const bytesDelta = bytesDownloaded - lastBytes;
          const bytesPerSecond = bytesDelta / elapsed;
          const remainingBytes = totalBytes - bytesDownloaded;
          const eta = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

          const progress: DownloadProgress = {
            bytesDownloaded,
            totalBytes,
            percent: totalBytes > 0 ? (bytesDownloaded / totalBytes) * 100 : 0,
            bytesPerSecond,
            eta
          };

          this.emit('progress', progress);
          onProgress?.(progress);

          lastProgressTime = now;
          lastBytes = bytesDownloaded;
        }
      }

      fileStream.end();

      logger.info('Download completed', {
        totalBytes: bytesDownloaded,
        duration: Date.now() - startTime
      });

      if (expectedChecksum) {
        const checksumResult = await this.verifyChecksum(targetPath, expectedChecksum);
        if (!checksumResult.valid) {
          throw new Error(`Checksum verification failed: expected ${expectedChecksum}, got ${checksumResult.hash}`);
        }
        logger.info('Checksum verification passed');
      }

      return targetPath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Download failed', err, { url });
      throw err;
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  async verifyChecksum(
    filePath: string,
    expectedHash: string,
    algorithm: string = 'sha256'
  ): Promise<ChecksumResult> {
    logger.info('Verifying checksum', { filePath, algorithm });

    const hash = await this.calculateFileChecksum(filePath, algorithm);
    const valid = hash === expectedHash.toLowerCase();

    return {
      algorithm,
      hash,
      valid
    };
  }

  async calculateFileChecksum(
    filePath: string,
    algorithm: string = 'sha256'
  ): Promise<string> {
    const { readFile } = await import('fs/promises');
    const data = await readFile(filePath);
    return createHash(algorithm).update(data).digest('hex');
  }

  async checkDependencies(dependencies: Record<string, string>): Promise<{
    valid: boolean;
    missing: string[];
    mismatched: Array<{ name: string; expected: string; actual: string }>;
  }> {
    const missing: string[] = [];
    const mismatched: Array<{ name: string; expected: string; actual: string }> = [];

    for (const [name, expectedVersion] of Object.entries(dependencies)) {
      try {
        const actualVersion = await this.getDependencyVersion(name);
        if (!this.satisfiesVersion(actualVersion, expectedVersion)) {
          mismatched.push({ name, expected: expectedVersion, actual: actualVersion });
        }
      } catch {
        missing.push(name);
      }
    }

    return {
      valid: missing.length === 0 && mismatched.length === 0,
      missing,
      mismatched
    };
  }

  private async getDependencyVersion(name: string): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`${name} --version`, { timeout: 5000 });
      return stdout.trim();
    } catch {
      throw new Error(`Dependency ${name} not found`);
    }
  }

  private satisfiesVersion(actual: string, expected: string): boolean {
    if (expected === '*' || expected === 'latest') {
      return true;
    }

    const actualClean = actual.replace(/[^\d.]/g, '');
    const expectedClean = expected.replace(/[^\d.]/g, '');

    if (expectedClean.startsWith('^')) {
      const major = expectedClean.substring(1).split('.')[0];
      return actualClean.startsWith(major);
    }

    if (expectedClean.startsWith('~')) {
      const [major, minor] = expectedClean.substring(1).split('.');
      return actualClean.startsWith(`${major}.${minor}`);
    }

    return actualClean === expectedClean;
  }

  private ensureTargetDirectory(targetPath: string): void {
    const dir = dirname(targetPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private generateDownloadId(url: string): string {
    return createHash('md5').update(url).update(Date.now().toString()).digest('hex');
  }

  cancel(downloadId: string): boolean {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      logger.info('Download cancelled', { downloadId });
      return true;
    }
    return false;
  }

  cancelAll(): void {
    for (const [id, controller] of this.activeDownloads) {
      controller.abort();
      logger.info('Download cancelled', { downloadId: id });
    }
    this.activeDownloads.clear();
  }

  getActiveDownloads(): string[] {
    return Array.from(this.activeDownloads.keys());
  }

  async downloadWithResume(
    url: string,
    targetPath: string,
    expectedChecksum?: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const maxRetries = 3;
    const retryDelay = 5000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.download({
          url,
          targetPath,
          expectedChecksum,
          resume: true
        }, onProgress);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Download attempt ${attempt + 1} failed, retrying...`, {
          error: err.message,
          retryDelay
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    throw new Error('Download failed after maximum retries');
  }
}

export const mcpDownloader = new MCPDownloader();
