import { describe, it, expect } from 'vitest';
import { CheckpointWriter } from '../checkpoint-writer';

describe('CheckpointWriter', () => {
  const writer = new CheckpointWriter();

  describe('serialize', () => {
    it('should serialize session state to JSON string', () => {
      const result = writer.serialize({
        conversationMessages: [{ role: 'user', content: 'hello' }],
        configSnapshot: { model: 'gpt-4' },
        toolRegistrySnapshot: { tools: ['read', 'write'] },
      });
      const parsed = JSON.parse(result);
      expect(parsed.conversationMessages.length).toBe(1);
      expect(parsed.configSnapshot.model).toBe('gpt-4');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      const plaintext = '{"messages":[{"role":"user","content":"test"}]}';
      const encrypted = writer.encrypt(plaintext);
      const decrypted = writer.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const plaintext = 'test data';
      const encrypted1 = writer.encrypt(plaintext);
      const encrypted2 = writer.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('verifyIntegrity', () => {
    it('should return true for valid encrypted data', () => {
      const encrypted = writer.encrypt('valid data');
      expect(writer.verifyIntegrity(encrypted)).toBe(true);
    });

    it('should return false for corrupted data', () => {
      expect(writer.verifyIntegrity('corrupted:data:here')).toBe(false);
    });
  });
});