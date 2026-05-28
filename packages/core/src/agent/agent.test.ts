import { describe, it, expect } from 'vitest';
import { looksLikeToolIntent, looksLikeTaskComplete } from './agent.js';

describe('Agent Logic Regression Tests', () => {
  describe('looksLikeTaskComplete', () => {
    it('should return true for simple completion signals', () => {
      expect(looksLikeTaskComplete('任务已完成')).toBe(true);
      expect(looksLikeTaskComplete('任务完成了。')).toBe(true);
      expect(looksLikeTaskComplete('done')).toBe(true);
      expect(looksLikeTaskComplete('all tasks done')).toBe(true);
    });

    it('should return false for short responses', () => {
      expect(looksLikeTaskComplete('好的')).toBe(false);
      expect(looksLikeTaskComplete('ok')).toBe(false);
    });

    it('should return false when completion is followed by continuation signals (THE FIX)', () => {
      // The core of the bug fix
      expect(looksLikeTaskComplete('任务已完成，接下来请处理第二个任务')).toBe(false);
      expect(looksLikeTaskComplete('已完成，然后下一步是...')).toBe(false);
      expect(looksLikeTaskComplete('全部搞定了，接下来')).toBe(false);
      expect(looksLikeTaskComplete('done, next step is...')).toBe(false);
    });

    it('should return false for purely incomplete signals', () => {
      expect(looksLikeTaskComplete('我准备开始')).toBe(false);
      expect(looksLikeTaskComplete('接下来我们要')).toBe(false);
    });
  });

  describe('looksLikeToolIntent', () => {
    it('should detect English tool intent', () => {
      expect(looksLikeToolIntent("I'll help you explore")).toBe(true);
      expect(looksLikeToolIntent("Let me check the file")).toBe(true);
      expect(looksLikeToolIntent("I'm going to run the command")).toBe(true);
    });

    it('should detect Chinese tool intent', () => {
      expect(looksLikeToolIntent("我这就为您查看")).toBe(true);
      expect(looksLikeToolIntent("让我来搜索一下")).toBe(true);
      expect(looksLikeToolIntent("首先检查一下")).toBe(true);
    });

    it('should return false for non-tool text', () => {
      expect(looksLikeToolIntent("Hello, how are you?")).toBe(false);
      expect(looksLikeToolIntent("Just a normal message")).toBe(false);
    });
  });
});
