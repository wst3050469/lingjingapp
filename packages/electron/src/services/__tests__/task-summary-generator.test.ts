import { describe, it, expect } from 'vitest';
import { TaskSummaryGenerator } from '../task-summary-generator';

describe('TaskSummaryGenerator', () => {
  const generator = new TaskSummaryGenerator();

  describe('generate', () => {
    it('should generate a task summary from events', () => {
      const events = [
        { type: 'tool_start', data: { name: 'read_file' } },
        { type: 'tool_end', data: { name: 'read_file', result: 'file content' } },
        { type: 'tool_start', data: { name: 'write_file' } },
        { type: 'tool_end', data: { name: 'write_file', result: 'success' } },
      ];
      const summary = generator.generate(events, 'session-1', 'Test Task');
      expect(summary.sessionId).toBe('session-1');
      expect(summary.title).toBe('Test Task');
      expect(summary.totalSteps).toBe(2);
      expect(summary.currentStep).toBe(2);
      expect(summary.progressPercent).toBe(100);
      expect(summary.status).toBe('completed');
    });

    it('should handle empty events', () => {
      const summary = generator.generate([], 'session-1');
      expect(summary.totalSteps).toBe(1);
      expect(summary.currentStep).toBe(0);
      expect(summary.progressPercent).toBe(0);
    });
  });

  describe('compressAction', () => {
    it('should truncate long actions to 100 chars', () => {
      const longAction = 'a'.repeat(150);
      const compressed = generator.compressAction(longAction);
      expect(compressed.length).toBeLessThanOrEqual(100);
      expect(compressed.endsWith('...')).toBe(true);
    });

    it('should keep short actions unchanged', () => {
      expect(generator.compressAction('short')).toBe('short');
    });
  });

  describe('extractProgress', () => {
    it('should calculate progress from events', () => {
      const events = [
        { type: 'tool_start' },
        { type: 'tool_end' },
        { type: 'tool_start' },
      ];
      const progress = generator.extractProgress(events);
      expect(progress.totalSteps).toBe(2);
      expect(progress.currentStep).toBe(1);
      expect(progress.progressPercent).toBe(50);
    });
  });
});