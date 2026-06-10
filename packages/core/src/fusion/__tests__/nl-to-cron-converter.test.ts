import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NLToCronConverter } from '../nl-cron/nl-to-cron-converter.js';

describe('NLToCronConverter', () => {
  let converter: NLToCronConverter;

  beforeEach(() => {
    converter = new NLToCronConverter();
  });

  describe('rule-based conversion', () => {
    it('should convert "every 5 minutes"', async () => {
      const result = await converter.convert('every 5 minutes');
      expect(result.cron).toBe('*/5 * * * *');
    });

    it('should convert "every 15 minutes"', async () => {
      const result = await converter.convert('every 15 minutes');
      expect(result.cron).toBe('*/15 * * * *');
    });

    it('should convert "hourly"', async () => {
      const result = await converter.convert('hourly');
      expect(result.cron).toBe('0 * * * *');
    });

    it('should convert "daily"', async () => {
      const result = await converter.convert('daily');
      expect(result.cron).toBe('0 0 * * *');
    });

    it('should convert "every monday"', async () => {
      const result = await converter.convert('every monday');
      expect(result.cron).toBe('0 0 * * 1');
    });

    it('should convert "weekly"', async () => {
      const result = await converter.convert('weekly');
      expect(result.cron).toBe('0 0 * * 1');
    });

    it('should convert "monthly"', async () => {
      const result = await converter.convert('monthly');
      expect(result.cron).toBe('0 0 1 * *');
    });

    it('should convert Chinese "每5分钟"', async () => {
      const result = await converter.convert('每5分钟');
      expect(result.cron).toBe('*/5 * * * *');
    });

    it('should convert Chinese "每天"', async () => {
      const result = await converter.convert('每天');
      expect(result.cron).toBe('0 0 * * *');
    });

    it('should convert "every 30 minutes"', async () => {
      const result = await converter.convert('every 30 minutes');
      expect(result.cron).toBe('*/30 * * * *');
    });

    it('should convert "every 10 minutes"', async () => {
      const result = await converter.convert('every 10 minutes');
      expect(result.cron).toBe('*/10 * * * *');
    });
  });

  describe('LLM conversion', () => {
    it('should fallback to rule-based when LLM returns invalid cron', async () => {
      const mockLLM = {
        chat: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield { type: 'text_delta', text: 'invalid cron' };
          }
        }),
      };
      const result = await converter.convert('every day', mockLLM as any);
      // Falls back to rule-based
      expect(result.cron).toBe('0 0 * * *');
    });

    it('should use LLM result when valid cron', async () => {
      const mockLLM = {
        chat: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield { type: 'text_delta', text: '30 9 * * 1' };
          }
        }),
      };
      const result = await converter.convert('every monday at 9:30', mockLLM as any);
      expect(result.cron).toBe('30 9 * * 1');
    });
  });

  describe('validateCron', () => {
    it('should validate a correct 5-field cron', () => {
      expect(converter.validateCron('*/5 * * * *')).toBe(true);
    });

    it('should reject an invalid cron', () => {
      expect(converter.validateCron('invalid')).toBe(false);
    });

    it('should reject cron with wrong field count', () => {
      expect(converter.validateCron('* * * * * *')).toBe(false);
    });
  });
});
