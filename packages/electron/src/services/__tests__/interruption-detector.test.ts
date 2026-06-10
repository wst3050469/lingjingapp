import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InterruptionDetector } from '../interruption-detector';

describe('InterruptionDetector', () => {
  let detector: InterruptionDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new InterruptionDetector();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startMonitoring / stopMonitoring', () => {
    it('should start and stop monitoring without errors', () => {
      detector.startMonitoring('test-session');
      expect(detector.isInterrupted('test-session')).toBe(false);
      detector.stopMonitoring('test-session');
    });
  });

  describe('isInterrupted', () => {
    it('should return false for non-monitored session', () => {
      expect(detector.isInterrupted('non-existent')).toBe(false);
    });
  });

  describe('markInterrupted', () => {
    it('should mark session as interrupted', () => {
      detector.startMonitoring('test-session');
      detector.markInterrupted('test-session');
      expect(detector.isInterrupted('test-session')).toBe(true);
      detector.stopMonitoring('test-session');
    });
  });

  describe('clearInterrupted', () => {
    it('should clear interrupted state', () => {
      detector.startMonitoring('test-session');
      detector.markInterrupted('test-session');
      detector.clearInterrupted('test-session');
      expect(detector.isInterrupted('test-session')).toBe(false);
      detector.stopMonitoring('test-session');
    });
  });

  describe('events', () => {
    it('should emit interrupted event', () => {
      const handler = vi.fn();
      detector.on('interrupted', handler);
      detector.startMonitoring('test-session');
      detector.markInterrupted('test-session');
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-session' });
      detector.stopMonitoring('test-session');
    });

    it('should emit recovery-requested event', () => {
      const handler = vi.fn();
      detector.on('recovery-requested', handler);
      detector.startMonitoring('test-session');
      detector.markInterrupted('test-session');
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-session' });
      detector.stopMonitoring('test-session');
    });
  });
});