import { describe, it, expect } from 'vitest';
import { CliAdapterExecutor } from '../cli-adapter-executor';

describe('CliAdapterExecutor', () => {
  const executor = new CliAdapterExecutor();

  describe('validateParams', () => {
    it('should validate required params', () => {
      const schema = { required: ['filePath'], properties: { filePath: { type: 'string' } } };
      expect(executor.validateParams({ filePath: '/test.kicad_sch' }, schema)).toBe(true);
      expect(executor.validateParams({}, schema)).toBe(false);
    });

    it('should validate param types', () => {
      const schema = { required: ['count'], properties: { count: { type: 'number' } } };
      expect(executor.validateParams({ count: 5 }, schema)).toBe(true);
      expect(executor.validateParams({ count: 'five' }, schema)).toBe(false);
    });
  });

  describe('parseOutput', () => {
    it('should parse JSON output', () => {
      const result = executor.parseOutput('{"violations":[]}', '', 0);
      expect(result.success).toBe(true);
      expect(result.data.violations).toEqual([]);
    });

    it('should handle non-JSON output', () => {
      const result = executor.parseOutput('plain text output', '', 0);
      expect(result.success).toBe(true);
      expect(result.data).toBe('plain text output');
    });

    it('should handle error exit code', () => {
      const result = executor.parseOutput('', 'error message', 1);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('error message');
    });
  });

  describe('isCommandAllowed', () => {
    it('should check command whitelist', () => {
      const allowed = ['kicad-cli schematic', 'kicad-cli pcb', 'kicad-cli drc'];
      expect(executor.isCommandAllowed('kicad-cli schematic edit', allowed)).toBe(true);
      expect(executor.isCommandAllowed('rm -rf /', allowed)).toBe(false);
    });
  });

  describe('getTimeoutForTool', () => {
    it('should return 60s for DRC tools', () => {
      expect(executor.getTimeoutForTool('kicad_drc_check')).toBe(60000);
    });

    it('should return 30s for other tools', () => {
      expect(executor.getTimeoutForTool('kicad_schematic_edit')).toBe(30000);
    });
  });
});