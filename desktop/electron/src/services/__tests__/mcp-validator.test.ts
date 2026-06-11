import { describe, it, expect, beforeEach } from 'vitest';
import { MCPValidator, MCPServiceConfig } from '../mcp-validator';

describe('MCPValidator', () => {
  let validator: MCPValidator;

  beforeEach(() => {
    validator = new MCPValidator();
  });

  describe('validateInstallRequest', () => {
    it('should validate correct service config', () => {
      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server',
        platform: ['win32', 'darwin', 'linux']
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing service name', () => {
      const config: MCPServiceConfig = {
        name: '',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server'
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Service name is required and must be a string');
    });

    it('should reject invalid service name', () => {
      const config: MCPServiceConfig = {
        name: 'INVALID_NAME!',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server'
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Service name contains invalid characters');
    });

    it('should reject invalid version format', () => {
      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'invalid',
        source: 'https://github.com/example/mcp-server'
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Service version format is invalid');
    });

    it('should reject invalid source URL', () => {
      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'v1.0.0',
        source: 'not-a-url'
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source URL format is invalid');
    });

    it('should reject unsupported platform', () => {
      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server',
        platform: ['linux']
      };

      const result = validator.validateInstallRequest(config);
      if (process.platform !== 'linux') {
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('does not support current platform'))).toBe(true);
      }
    });

    it('should reject already installed service', () => {
      validator.registerInstalledService('github-mcp');

      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server'
      };

      const result = validator.validateInstallRequest(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Service "github-mcp" is already installed');
    });

    it('should warn about sensitive config parameters', () => {
      const config: MCPServiceConfig = {
        name: 'github-mcp',
        version: 'v1.0.0',
        source: 'https://github.com/example/mcp-server',
        config: {
          password: 'secret123',
          token: 'abc123'
        }
      };

      const result = validator.validateInstallRequest(config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('password'))).toBe(true);
      expect(result.warnings.some(w => w.includes('token'))).toBe(true);
    });
  });

  describe('registerInstalledService', () => {
    it('should register service as installed', () => {
      validator.registerInstalledService('test-service');
      expect(validator.isServiceInstalled('test-service')).toBe(true);
    });
  });

  describe('unregisterInstalledService', () => {
    it('should unregister installed service', () => {
      validator.registerInstalledService('test-service');
      validator.unregisterInstalledService('test-service');
      expect(validator.isServiceInstalled('test-service')).toBe(false);
    });
  });

  describe('getInstalledServices', () => {
    it('should return list of installed services', () => {
      validator.registerInstalledService('service1');
      validator.registerInstalledService('service2');

      const services = validator.getInstalledServices();
      expect(services).toContain('service1');
      expect(services).toContain('service2');
    });
  });
});
