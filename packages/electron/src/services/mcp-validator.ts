import { createLogger } from '../monitoring/logger';

const logger = createLogger('mcp-validator');

export interface MCPServiceConfig {
  name: string;
  version: string;
  source: string;
  platform?: string[];
  dependencies?: Record<string, string>;
  config?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MCPValidator {
  private installedServices: Set<string>;
  private platform: string;

  constructor() {
    this.installedServices = new Set();
    this.platform = process.platform;
  }

  validateInstallRequest(config: MCPServiceConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info('Validating MCP service install request', { 
      serviceName: config.name,
      version: config.version 
    });

    if (!config.name || typeof config.name !== 'string') {
      errors.push('Service name is required and must be a string');
    } else if (!this.isValidServiceName(config.name)) {
      errors.push('Service name contains invalid characters');
    }

    if (!config.version || typeof config.version !== 'string') {
      errors.push('Service version is required and must be a string');
    } else if (!this.isValidVersion(config.version)) {
      errors.push('Service version format is invalid');
    }

    if (!config.source || typeof config.source !== 'string') {
      errors.push('Source URL is required and must be a string');
    } else if (!this.isValidUrl(config.source)) {
      errors.push('Source URL format is invalid');
    }

    if (config.platform && config.platform.length > 0) {
      if (!config.platform.includes(this.platform)) {
        errors.push(`Service does not support current platform: ${this.platform}`);
      }
    }

    if (this.installedServices.has(config.name)) {
      errors.push(`Service "${config.name}" is already installed`);
    }

    if (config.dependencies) {
      const depErrors = this.validateDependencies(config.dependencies);
      errors.push(...depErrors);
    }

    if (config.config) {
      const configWarnings = this.validateConfigParameters(config.config);
      warnings.push(...configWarnings);
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings
    };

    if (result.valid) {
      logger.info('MCP service validation passed', { serviceName: config.name });
    } else {
      logger.warn('MCP service validation failed', { 
        serviceName: config.name,
        errors 
      });
    }

    return result;
  }

  private isValidServiceName(name: string): boolean {
    const nameRegex = /^[a-z0-9-]+$/;
    return nameRegex.test(name) && name.length > 0 && name.length <= 100;
  }

  private isValidVersion(version: string): boolean {
    const versionRegex = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    return versionRegex.test(version);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private validateDependencies(dependencies: Record<string, string>): string[] {
    const errors: string[] = [];
    
    for (const [name, version] of Object.entries(dependencies)) {
      if (!name || typeof name !== 'string') {
        errors.push(`Invalid dependency name: ${name}`);
      }
      
      if (!version || typeof version !== 'string') {
        errors.push(`Invalid version for dependency "${name}": ${version}`);
      }
    }

    return errors;
  }

  private validateConfigParameters(config: Record<string, any>): string[] {
    const warnings: string[] = [];
    
    for (const [key, value] of Object.entries(config)) {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')) {
        warnings.push(`Config parameter "${key}" appears to be sensitive, ensure it's encrypted`);
      }
    }

    return warnings;
  }

  registerInstalledService(serviceName: string): void {
    this.installedServices.add(serviceName);
    logger.info('Service registered as installed', { serviceName });
  }

  unregisterInstalledService(serviceName: string): void {
    this.installedServices.delete(serviceName);
    logger.info('Service unregistered', { serviceName });
  }

  isServiceInstalled(serviceName: string): boolean {
    return this.installedServices.has(serviceName);
  }

  getInstalledServices(): string[] {
    return Array.from(this.installedServices);
  }
}

export const mcpValidator = new MCPValidator();
