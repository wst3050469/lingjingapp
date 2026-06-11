import { HttpClient } from './http-client';
import { VersionParser, SemanticVersion } from '@codepilot/core/utils';
import { createLogger } from '../monitoring/logger';

const logger = createLogger('version');

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  needsUpgrade: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  checkedAt: Date;
}

export interface VersionInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  downloadUrl?: string;
  platform?: string;
}

export class VersionService {
  private httpClient: HttpClient;
  private currentVersion: string;
  private versionServerUrl: string;
  private timeout: number;

  constructor(
    currentVersion: string,
    versionServerUrl: string = 'https://ide.zhejiangjinmo.com',
    timeout: number = 5000
  ) {
    this.currentVersion = currentVersion;
    this.versionServerUrl = versionServerUrl;
    this.timeout = timeout;

    logger.info('VersionService initialized', {
      currentVersion,
      versionServerUrl,
      timeout
    });

    this.httpClient = new HttpClient({
      baseURL: versionServerUrl,
      timeout: this.timeout,
      retry: {
        maxRetries: 3,
        retryDelay: 1000,
        maxRetryDelay: 3000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      enableLogging: true
    });
  }

  async checkForUpdates(): Promise<VersionCheckResult> {
    logger.info('Starting version check', {
      currentVersion: this.currentVersion,
      serverUrl: this.versionServerUrl
    });

    try {
      const versionInfo = await this.fetchLatestVersion();

      const currentParsed = VersionParser.parse(this.currentVersion);
      const latestParsed = VersionParser.parse(versionInfo.version);

      const needsUpgrade = VersionParser.needsUpgrade(this.currentVersion, versionInfo.version);

      const result: VersionCheckResult = {
        currentVersion: this.currentVersion,
        latestVersion: versionInfo.version,
        needsUpgrade,
        releaseNotes: versionInfo.releaseNotes,
        downloadUrl: versionInfo.downloadUrl,
        checkedAt: new Date()
      };

      logger.info('Version check completed', {
        currentVersion: this.currentVersion,
        latestVersion: versionInfo.version,
        needsUpgrade,
        comparison: VersionParser.compare(currentParsed, latestParsed)
      });

      return result;
    } catch (error) {
      logger.error('Version check failed', error as Error, {
        currentVersion: this.currentVersion,
        serverUrl: this.versionServerUrl
      });

      throw new Error(`Version check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchLatestVersion(): Promise<VersionInfo> {
    // Define multiple possible API endpoints
    const endpoints = [
      { path: '/latest.yml', format: 'yaml' },
      { path: '/api/latest', format: 'json' },
      { path: '/api/version/latest', format: 'json' }
    ];

    logger.info('Fetching latest version from server...');

    for (const endpoint of endpoints) {
      try {
        logger.info(`Trying endpoint: ${endpoint.path} (${endpoint.format})`);

        const response = await this.httpClient.get<string>(endpoint.path, {
          timeout: this.timeout
        });

        logger.debug(`Response from ${endpoint.path}: ${typeof response === 'string' ? response.substring(0, 100) : JSON.stringify(response)}`);

        // Parse response (support both YAML and JSON)
        const versionInfo = this.parseVersionResponse(response, endpoint.format);

        if (versionInfo && versionInfo.version) {
          logger.info(`✓ Successfully parsed version from ${endpoint.path}:`, versionInfo);
          return versionInfo;
        } else {
          logger.warn(`Failed to parse version from ${endpoint.path}`);
        }

      } catch (err) {
        const errorMsg = (err as Error).message;
        (logger.warn as any)(`✗ Endpoint ${endpoint.path} failed:`, errorMsg);

        // Record HTTP status code if available
        if ((err as any).statusCode) {
          logger.debug(`HTTP status: ${(err as any).statusCode}`);
        }

        continue; // Try next endpoint
      }
    }

    // All endpoints failed
    throw new Error('All version endpoints failed. Unable to fetch version information.');
  }

  /**
   * Parse version response (support both YAML and JSON formats)
   * @param response HTTP response content
   * @param format Expected format (yaml or json)
   * @returns Parsed version info, or null if parsing fails
   */
  private parseVersionResponse(response: string | object, format: string): VersionInfo | null {
    try {
      // If response is already an object (HttpClient may have parsed JSON)
      if (typeof response === 'object' && response !== null) {
        const obj = response as any;

        // Validate required fields
        if (obj.version && typeof obj.version === 'string') {
          return {
            version: obj.version,
            releaseDate: obj.releaseDate || obj.release_date || new Date().toISOString(),
            releaseNotes: obj.releaseNotes || obj.release_notes || '',
            downloadUrl: obj.downloadUrl || obj.download_url || ''
          };
        }

        return null;
      }

      // If response is a string
      if (typeof response === 'string') {
        const trimmed = response.trim();

        // Try parsing YAML format
        if (format === 'yaml' || trimmed.startsWith('version:')) {
          return this.parseYamlVersion(trimmed);
        }

        // Try parsing JSON format
        if (format === 'json' || trimmed.startsWith('{')) {
          return this.parseJsonVersion(trimmed);
        }

        // Auto-detect format
        if (trimmed.includes('version:') && !trimmed.startsWith('{')) {
          return this.parseYamlVersion(trimmed);
        } else if (trimmed.startsWith('{')) {
          return this.parseJsonVersion(trimmed);
        }
      }

      return null;

    } catch (err) {
      logger.error('Parse error:', err as Error);
      return null;
    }
  }

  /**
   * Parse YAML format version info
   * Simple parser, doesn't require yaml library
   */
  private parseYamlVersion(yamlString: string): VersionInfo | null {
    try {
      // Extract version field
      const versionMatch = yamlString.match(/version:\s*['"]?([^'"\n]+)['"]?/);
      if (!versionMatch) {
        logger.warn('No version field found in YAML');
        return null;
      }

      // Extract releaseDate field (optional)
      const releaseDateMatch = yamlString.match(/releaseDate:\s*['"]?([^'"\n]+)['"]?/);

      // Extract releaseNotes field (optional)
      const releaseNotesMatch = yamlString.match(/releaseNotes:\s*['"]?([^'"\n]+)['"]?/);

      return {
        version: versionMatch[1].trim(),
        releaseDate: releaseDateMatch ? releaseDateMatch[1].trim() : new Date().toISOString(),
        releaseNotes: releaseNotesMatch ? releaseNotesMatch[1].trim() : '',
        downloadUrl: ''
      };

    } catch (err) {
      logger.error('YAML parse error:', err as Error);
      return null;
    }
  }

  /**
   * Parse JSON format version info
   */
  private parseJsonVersion(jsonString: string): VersionInfo | null {
    try {
      const obj = JSON.parse(jsonString);

      if (!obj.version || typeof obj.version !== 'string') {
        logger.warn('No valid version field in JSON');
        return null;
      }

      return {
        version: obj.version,
        releaseDate: obj.releaseDate || obj.release_date || new Date().toISOString(),
        releaseNotes: obj.releaseNotes || obj.release_notes || '',
        downloadUrl: obj.downloadUrl || obj.download_url || ''
      };

    } catch (err) {
      logger.error('JSON parse error:', err as Error);
      return null;
    }
  }

  async getVersionHistory(limit: number = 10): Promise<VersionInfo[]> {
    logger.info('Fetching version history', { limit });

    try {
      const response = await this.httpClient.get<VersionInfo[]>('/history', {
        params: { limit },
        timeout: this.timeout
      });

      if (!Array.isArray(response)) {
        throw new Error('Invalid response format for version history');
      }

      logger.debug('Fetched version history', { count: response.length });

      return response;
    } catch (error) {
      logger.error('Failed to fetch version history', error as Error);
      throw error;
    }
  }

  validateCurrentVersion(): boolean {
    try {
      const parsed = VersionParser.parse(this.currentVersion);
      logger.info('Current version validated', {
        version: this.currentVersion,
        parsed
      });
      return true;
    } catch (error) {
      logger.error('Current version is invalid', error as Error, {
        currentVersion: this.currentVersion
      });
      return false;
    }
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getCurrentVersionParsed(): SemanticVersion {
    return VersionParser.parse(this.currentVersion);
  }
}

export function createVersionService(currentVersion: string): VersionService {
  return new VersionService(currentVersion);
}
