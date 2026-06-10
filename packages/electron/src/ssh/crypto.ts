// Credential encryption utility using Electron safeStorage

import { safeStorage } from 'electron';

export function encryptCredential(plainText: string): string {
  if (!plainText) return '';
  
  try {
    const encrypted = safeStorage.encryptString(plainText);
    return encrypted.toString('base64');
  } catch (error) {
    console.error('[SSH Crypto] Failed to encrypt credential:', error);
    // Fallback: store as plain text with warning
    console.warn('[SSH Crypto] safeStorage unavailable, storing credential in plaintext');
    return `plaintext:${plainText}`;
  }
}

export function decryptCredential(encrypted: string): string {
  if (!encrypted) return '';
  
  // Check if it's plaintext fallback
  if (encrypted.startsWith('plaintext:')) {
    return encrypted.slice(10);
  }
  
  try {
    const buffer = Buffer.from(encrypted, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return decrypted;
  } catch (error) {
    console.error('[SSH Crypto] Failed to decrypt credential:', error);
    return '';
  }
}

export function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}
