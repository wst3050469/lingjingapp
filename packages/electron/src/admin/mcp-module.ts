import { createLogger } from '../monitoring/logger';
import { MCPInstaller, InstallProgress } from '../services/mcp-installer';
import { MCPDownloader } from '../services/mcp-downloader';
import { MCPValidator, MCPServiceConfig } from '../services/mcp-validator';

const logger = createLogger('mcp-module');

export interface MCPServiceInfo {
  name: string;
  version: string;
  status: 'installed' | 'available' | 'updating' | 'error';
  installPath?: string;
  config?: MCPServiceConfig;
  lastUpdated?: number;
}

export interface MCPMarketplaceEntry {
  id: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  stars: number;
  category: string;
  installed: boolean;
  homepage?: string;
  repository?: string;
}

export class MCPModule {
  private installer: MCPInstaller;
  private downloader: MCPDownloader;
  private validator: MCPValidator;
  private services: Map<string, MCPServiceInfo>;

  constructor() {
    this.installer = new MCPInstaller();
    this.downloader = new MCPDownloader();
    this.validator = new MCPValidator();
    this.services = new Map();

    this.installer.on('progress', (progress: InstallProgress) => {
      logger.info('Installation progress', {
        service: progress.serviceName,
        stage: progress.stage,
        progress: progress.progress
      });
    });
  }

  async listServices(): Promise<MCPServiceInfo[]> {
    return Array.from(this.services.values());
  }

  async getService(name: string): Promise<MCPServiceInfo | null> {
    return this.services.get(name) || null;
  }

  async installService(
    config: MCPServiceConfig,
    onProgress?: (progress: InstallProgress) => void
  ): Promise<{ success: boolean; message: string; service?: MCPServiceInfo }> {
    logger.info('Installing MCP service', { name: config.name });

    const result = await this.installer.install(config, onProgress);

    if (result.success) {
      const serviceInfo: MCPServiceInfo = {
        name: config.name,
        version: config.version,
        status: 'installed',
        installPath: result.installPath,
        config,
        lastUpdated: Date.now()
      };

      this.services.set(config.name, serviceInfo);

      return {
        success: true,
        message: `Service ${config.name} installed successfully`,
        service: serviceInfo
      };
    }

    return {
      success: false,
      message: result.error || 'Installation failed'
    };
  }

  async uninstallService(name: string): Promise<{ success: boolean; message: string }> {
    logger.info('Uninstalling MCP service', { name });

    const service = this.services.get(name);
    if (!service) {
      return {
        success: false,
        message: `Service ${name} not found`
      };
    }

    this.validator.unregisterInstalledService(name);
    this.services.delete(name);

    return {
      success: true,
      message: `Service ${name} uninstalled successfully`
    };
  }

  async updateService(
    name: string,
    version: string
  ): Promise<{ success: boolean; message: string }> {
    logger.info('Updating MCP service', { name, version });

    const service = this.services.get(name);
    if (!service) {
      return {
        success: false,
        message: `Service ${name} not found`
      };
    }

    const updatedConfig: MCPServiceConfig = {
      ...service.config!,
      version
    };

    this.services.set(name, {
      ...service,
      status: 'updating'
    });

    const result = await this.installer.install(updatedConfig);

    if (result.success) {
      this.services.set(name, {
        name,
        version,
        status: 'installed',
        installPath: result.installPath,
        config: updatedConfig,
        lastUpdated: Date.now()
      });

      return {
        success: true,
        message: `Service ${name} updated to ${version}`
      };
    }

    this.services.set(name, {
      ...service,
      status: 'error'
    });

    return {
      success: false,
      message: result.error || 'Update failed'
    };
  }

  async listMarketplace(): Promise<MCPMarketplaceEntry[]> {
    return [
      {
        id: 'github',
        name: 'github',
        publisher: 'ModelContextProtocol',
        description: 'GitHub API integration',
        version: '1.0.0',
        stars: 5000,
        category: 'Development',
        installed: this.validator.isServiceInstalled('github'),
        repository: 'https://github.com/modelcontextprotocol/servers'
      },
      {
        id: 'fetch',
        name: 'fetch',
        publisher: 'ModelContextProtocol',
        description: 'Web content fetching',
        version: '1.0.0',
        stars: 3000,
        category: 'Data',
        installed: this.validator.isServiceInstalled('fetch')
      },
      {
        id: 'filesystem',
        name: 'filesystem',
        publisher: 'ModelContextProtocol',
        description: 'File system operations',
        version: '1.0.0',
        stars: 4000,
        category: 'Development',
        installed: this.validator.isServiceInstalled('filesystem')
      }
    ];
  }

  async installFromMarketplace(
    id: string,
    env?: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    const marketplace = await this.listMarketplace();
    const entry = marketplace.find(e => e.id === id);

    if (!entry) {
      return {
        success: false,
        message: `Service ${id} not found in marketplace`
      };
    }

    const config: MCPServiceConfig = {
      name: entry.name,
      version: entry.version,
      source: `https://mcp.modelcontextprotocol.io/${entry.id}`,
      config: { env }
    };

    return this.installService(config);
  }

  async getServiceStatus(name: string): Promise<{
    installed: boolean;
    version?: string;
    status?: string;
  }> {
    const service = this.services.get(name);

    return {
      installed: this.validator.isServiceInstalled(name),
      version: service?.version,
      status: service?.status
    };
  }

  async checkForUpdates(name: string): Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    currentVersion?: string;
  }> {
    const service = this.services.get(name);

    if (!service) {
      return { hasUpdate: false };
    }

    return {
      hasUpdate: false,
      currentVersion: service.version
    };
  }

  cancelInstall(name: string): boolean {
    return this.installer.cancel(name);
  }

  isInstalling(name: string): boolean {
    return this.installer.isInstalling(name);
  }
}

export const mcpModule = new MCPModule();
