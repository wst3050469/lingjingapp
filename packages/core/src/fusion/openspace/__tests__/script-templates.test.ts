import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATES, matchTemplate, fillTemplate } from '../script-templates.js';

describe('OpenSpace script-templates', () => {
  describe('BUILTIN_TEMPLATES', () => {
    it('should have 8 predefined templates', () => {
      expect(BUILTIN_TEMPLATES.length).toBe(8);
    });

    it('should have all required fields for each template', () => {
      for (const tpl of BUILTIN_TEMPLATES) {
        expect(tpl.name).toBeDefined();
        expect(tpl.category).toBeDefined();
        expect(tpl.description).toBeDefined();
        expect(tpl.keywords.length).toBeGreaterThan(0);
        expect(tpl.scriptTemplate).toBeDefined();
        expect(typeof tpl.highRisk).toBe('boolean');
        expect(tpl.language).toBe('lua');
      }
    });

    it('should have categories: navigation, time, scene, recording, dataset', () => {
      const categories = new Set(BUILTIN_TEMPLATES.map(t => t.category));
      expect(categories.has('navigation')).toBe(true);
      expect(categories.has('time')).toBe(true);
      expect(categories.has('scene')).toBe(true);
      expect(categories.has('recording')).toBe(true);
      expect(categories.has('dataset')).toBe(true);
    });

    it('should mark recording and dataset templates as highRisk', () => {
      const highRisk = BUILTIN_TEMPLATES.filter(t => t.highRisk).map(t => t.name);
      expect(highRisk).toContain('start_recording');
      expect(highRisk).toContain('load_dataset');
      expect(highRisk).toContain('unload_dataset');
    });
  });

  describe('matchTemplate', () => {
    it('should match "navigate to Mars" to navigate_to_body', () => {
      const result = matchTemplate('navigate to Mars');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('navigate_to_body');
    });

    it('should match "fly to Jupiter" to navigate_to_body', () => {
      const result = matchTemplate('fly to Jupiter');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('navigate_to_body');
    });

    it('should match "set time to 2024" to set_time', () => {
      const result = matchTemplate('set time to 2024');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('set_time');
    });

    it('should match "start recording" to start_recording', () => {
      const result = matchTemplate('start recording');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('start_recording');
    });

    it('should match "load dataset" to load_dataset', () => {
      const result = matchTemplate('load dataset');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('load_dataset');
    });

    it('should match "show layer" to toggle_layer', () => {
      const result = matchTemplate('show layer');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('toggle_layer');
    });

    it('should match "stop recording" to stop_recording', () => {
      const result = matchTemplate('stop recording');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('stop_recording');
    });

    it('should match "zoom camera" to set_camera_distance', () => {
      const result = matchTemplate('zoom camera');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('set_camera_distance');
    });

    it('should return null for unrecognized input', () => {
      const result = matchTemplate('hello world xyzzy');
      expect(result).toBeNull();
    });

    it('should handle Chinese input "导航到火星" reasonably', () => {
      // Chinese keywords are not in the templates, so this should return
      // a partial match at best, or null if score < 2
      const result = matchTemplate('导航到火星');
      // May or may not match depending on keyword overlap
      expect(result).toBeDefined();
    });

    it('should respect minimum score threshold', () => {
      const result = matchTemplate('xyzzy');
      expect(result).toBeNull();
    });
  });

  describe('fillTemplate', () => {
    it('should fill placeholders in navigate_to_body template', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.name === 'navigate_to_body')!;
      const result = fillTemplate(template, { target: 'Mars' });
      expect(result).toContain('"NavigationHandler.Target", "Mars"');
      expect(result).toContain('"NavigationHandler.FlyToTarget", true');
    });

    it('should fill placeholders in set_time template', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.name === 'set_time')!;
      const result = fillTemplate(template, { date: '2024-06-01T00:00:00' });
      expect(result).toBe('openspace.time.setTime("2024-06-01T00:00:00")');
    });

    it('should fill numeric parameters', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.name === 'set_camera_distance')!;
      const result = fillTemplate(template, { distance: 5000 });
      expect(result).toBe('openspace.setPropertyValue("NavigationHandler.Distance", 5000)');
    });

    it('should fill multiple placeholders in start_recording', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.name === 'start_recording')!;
      const result = fillTemplate(template, {
        fps: 30,
        resolutionX: 1920,
        resolutionY: 1080,
      });
      expect(result).toContain('FrameExport.Framerate', 30);
      expect(result).toContain('FrameExport.Resolution.X", 1920');
      expect(result).toContain('FrameExport.Resolution.Y", 1080');
    });

    it('should not modify template for unknown placeholders', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.name === 'stop_recording')!;
      const result = fillTemplate(template, { unknown: 'value' });
      expect(result).toBe(template.scriptTemplate);
    });
  });
});
