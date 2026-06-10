import { describe, it, expect } from 'vitest';
import { BugAnalyzer } from '../bug-analyzer';
import type { BugRecord } from '../../db/types/ide-enhance-types';

describe('BugAnalyzer', () => {
  const analyzer = new BugAnalyzer();

  describe('classify', () => {
    it('should classify bugs by severity::module', () => {
      const bugs: BugRecord[] = [
        { id: '1', severity: 'CRITICAL', module: 'agent', title: 'A', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
        { id: '2', severity: 'HIGH', module: 'memory', title: 'B', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
        { id: '3', severity: 'CRITICAL', module: 'agent', title: 'C', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
      ];
      const classified = analyzer.classify(bugs);
      expect(classified.get('CRITICAL::agent')?.length).toBe(2);
      expect(classified.get('HIGH::memory')?.length).toBe(1);
    });
  });

  describe('prioritize', () => {
    it('should sort by severity CRITICAL > HIGH > MEDIUM > LOW', () => {
      const bugs: BugRecord[] = [
        { id: '1', severity: 'LOW', module: 'x', title: 'A', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
        { id: '2', severity: 'CRITICAL', module: 'x', title: 'B', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
        { id: '3', severity: 'MEDIUM', module: 'x', title: 'C', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
        { id: '4', severity: 'HIGH', module: 'x', title: 'D', description: '', status: 'open', fixDescription: '', affectedFiles: [], createdAt: '', updatedAt: '' },
      ];
      const sorted = analyzer.prioritize(bugs);
      expect(sorted[0].severity).toBe('CRITICAL');
      expect(sorted[1].severity).toBe('HIGH');
      expect(sorted[2].severity).toBe('MEDIUM');
      expect(sorted[3].severity).toBe('LOW');
    });
  });

  describe('identifyKnown', () => {
    it('should return 4 known bugs', () => {
      const known = analyzer.identifyKnown();
      expect(known.length).toBe(4);
      expect(known.some((b) => b.id === 'BUG-001')).toBe(true);
      expect(known.some((b) => b.id === 'BUG-002')).toBe(true);
      expect(known.some((b) => b.id === 'BUG-003')).toBe(true);
      expect(known.some((b) => b.id === 'BUG-004')).toBe(true);
    });
  });
});