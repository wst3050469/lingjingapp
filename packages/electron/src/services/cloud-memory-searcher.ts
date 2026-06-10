import { createLogger } from '../monitoring/logger';

const logger = createLogger('cloud-memory-searcher');

const CLOUD_API_BASE = process.env.LINGJING_CLOUD_API || 'https://ide.zhejiangjinmo.com/api/v1';

export interface CloudMemoryResult {
  id: string;
  title: string;
  content: string;
  category: string;
  scope: string;
  source: string;
  score?: number;
}

export class CloudMemorySearcher {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LINGJING_CLOUD_API_KEY || '';
  }

  async search(keywords: string, projectPath?: string): Promise<CloudMemoryResult[]> {
    if (!this.apiKey) {
      logger.debug('No cloud API key configured, skipping cloud memory search');
      return [];
    }

    try {
      const response = await fetch(`${CLOUD_API_BASE}/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ keywords, projectPath, limit: 10 }),
      });

      if (!response.ok) {
        logger.warn('Cloud memory search failed', { status: response.status });
        return [];
      }

      const data = await response.json();
      const results: CloudMemoryResult[] = data.memories ?? data.results ?? [];
      logger.info('Cloud memory search completed', { keywords, resultCount: results.length });
      return results;
    } catch (err) {
      logger.error('Cloud memory search error', err as Error);
      return [];
    }
  }

  async pullMemories(projectPath?: string): Promise<CloudMemoryResult[]> {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${CLOUD_API_BASE}/memories?limit=50${projectPath ? `&projectPath=${encodeURIComponent(projectPath)}` : ''}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.memories ?? [];
    } catch (err) {
      logger.error('Cloud memory pull error', err as Error);
      return [];
    }
  }

  formatResults(results: CloudMemoryResult[]): string {
    if (results.length === 0) return '';
    const lines = results.map((r) => `[Cloud] [${r.category}] ${r.title}: ${r.content}`);
    lines.unshift('> **Note**: Cloud memories synced from other devices.');
    return lines.join('\n');
  }
}

export const cloudMemorySearcher = new CloudMemorySearcher();