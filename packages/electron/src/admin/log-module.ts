import { createLogger } from '../monitoring/logger';
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import { createGunzip, createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const logger = createLogger('log-module');

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  context: string;
  message: string;
  metadata?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogFilter {
  level?: LogEntry['level'][];
  context?: string[];
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogStats {
  totalEntries: number;
  byLevel: Record<string, number>;
  byContext: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
}

export class LogModule {
  private logDir: string;
  private maxLogSize: number;
  private maxLogFiles: number;

  constructor() {
    this.logDir = join(homedir(), '.lingjing', 'logs');
    this.maxLogSize = 10 * 1024 * 1024;
    this.maxLogFiles = 10;

    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  async queryLogs(filter?: LogFilter): Promise<LogEntry[]> {
    const logFiles = this.getLogFiles();
    const entries: LogEntry[] = [];

    for (const file of logFiles) {
      const fileEntries = await this.parseLogFile(file);
      entries.push(...fileEntries);
    }

    let filtered = this.applyFilters(entries, filter);

    if (filter?.offset !== undefined) {
      filtered = filtered.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  private applyFilters(entries: LogEntry[], filter?: LogFilter): LogEntry[] {
    if (!filter) {
      return entries;
    }

    return entries.filter(entry => {
      if (filter.level && !filter.level.includes(entry.level)) {
        return false;
      }

      if (filter.context && !filter.context.includes(entry.context)) {
        return false;
      }

      if (filter.from && entry.timestamp < filter.from) {
        return false;
      }

      if (filter.to && entry.timestamp > filter.to) {
        return false;
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchMessage = entry.message.toLowerCase().includes(searchLower);
        const matchContext = entry.context.toLowerCase().includes(searchLower);
        const matchMetadata = entry.metadata &&
          JSON.stringify(entry.metadata).toLowerCase().includes(searchLower);

        if (!matchMessage && !matchContext && !matchMetadata) {
          return false;
        }
      }

      return true;
    });
  }

  private async parseLogFile(filePath: string): Promise<LogEntry[]> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entries: LogEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const entry = this.parseLogLine(line);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          logger.debug('Failed to parse log line', { line, error });
        }
      }

      return entries;
    } catch (error) {
      logger.error('Failed to read log file', error as Error, { filePath });
      return [];
    }
  }

  private parseLogLine(line: string): LogEntry | null {
    const timestampMatch = line.match(/^\[([^\]]+)\]/);
    const levelMatch = line.match(/\[(DEBUG|INFO|WARN|ERROR)\]/);
    const contextMatch = line.match(/\[([^\]]+)\]\s*$/);

    if (!timestampMatch || !levelMatch) {
      return null;
    }

    const timestamp = timestampMatch[1];
    const level = levelMatch[1] as LogEntry['level'];
    const context = contextMatch ? contextMatch[1] : 'unknown';
    const message = line.substring(
      timestampMatch[0].length + levelMatch[0].length + 1
    ).trim();

    return {
      timestamp,
      level,
      context,
      message
    };
  }

  async getStats(): Promise<LogStats> {
    const entries = await this.queryLogs({ limit: 10000 });

    const stats: LogStats = {
      totalEntries: entries.length,
      byLevel: {},
      byContext: {}
    };

    for (const entry of entries) {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byContext[entry.context] = (stats.byContext[entry.context] || 0) + 1;
    }

    if (entries.length > 0) {
      stats.oldestEntry = entries[0].timestamp;
      stats.newestEntry = entries[entries.length - 1].timestamp;
    }

    return stats;
  }

  async getRecentErrors(count: number = 10): Promise<LogEntry[]> {
    return this.queryLogs({
      level: ['ERROR'],
      limit: count
    });
  }

  async clearLogs(before?: string): Promise<{ deleted: number }> {
    const logFiles = this.getLogFiles();
    let deleted = 0;

    for (const file of logFiles) {
      if (before) {
        const fileDate = basename(file).replace('app-', '').replace('.log', '');
        if (fileDate < before) {
          unlinkSync(file);
          deleted++;
        }
      } else {
        unlinkSync(file);
        deleted++;
      }
    }

    logger.info('Logs cleared', { deleted });

    return { deleted };
  }

  async exportLogs(outputPath: string, filter?: LogFilter): Promise<void> {
    const entries = await this.queryLogs(filter);
    const content = entries.map(e => JSON.stringify(e)).join('\n');

    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, content, 'utf-8');

    logger.info('Logs exported', { path: outputPath, count: entries.length });
  }

  async compressOldLogs(): Promise<number> {
    const logFiles = this.getLogFiles();
    const today = new Date().toISOString().split('T')[0];
    let compressed = 0;

    for (const file of logFiles) {
      const fileName = basename(file);
      if (fileName.includes(today)) {
        continue;
      }

      if (extname(file) === '.gz') {
        continue;
      }

      const gzPath = `${file}.gz`;

      try {
        await pipeline(
          createReadStream(file),
          createGzip(),
          createWriteStream(gzPath)
        );

        unlinkSync(file);
        compressed++;

        logger.debug('Log compressed', { file: fileName });
      } catch (error) {
        logger.error('Failed to compress log', error as Error, { file });
      }
    }

    logger.info('Old logs compressed', { compressed });

    return compressed;
  }

  private getLogFiles(): string[] {
    const files = readdirSync(this.logDir);
    return files
      .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
      .map(f => join(this.logDir, f))
      .sort((a, b) => {
        const statA = statSync(a);
        const statB = statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
  }

  async rotateLogs(): Promise<void> {
    const logFile = join(this.logDir, 'app.log');

    if (!existsSync(logFile)) {
      return;
    }

    const stat = statSync(logFile);
    if (stat.size < this.maxLogSize) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = join(this.logDir, `app-${timestamp}.log`);

    renameSync(logFile, rotatedFile);

    logger.info('Log rotated', { from: logFile, to: rotatedFile });

    this.cleanOldLogs();
  }

  private cleanOldLogs(): void {
    const logFiles = this.getLogFiles();

    if (logFiles.length <= this.maxLogFiles) {
      return;
    }

    const toDelete = logFiles.slice(this.maxLogFiles);

    for (const file of toDelete) {
      unlinkSync(file);
      logger.debug('Old log deleted', { file: basename(file) });
    }
  }
}

export const logModule = new LogModule();
