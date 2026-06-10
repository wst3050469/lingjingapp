// Secure token storage - stub implementation
// Real implementation uses Electron's safeStorage API in the main process

export class SecureTokenStorage {
  private _store = new Map<string, string>();

  async saveToken(key: string, value: string): Promise<void> {
    this._store.set(key, value);
  }

  async loadToken(key: string): Promise<string | null> {
    return this._store.get(key) ?? null;
  }

  async deleteToken(key: string): Promise<boolean> {
    return this._store.delete(key);
  }

  listKeys(filter?: string): string[] {
    const keys = Array.from(this._store.keys());
    if (filter) {
      return keys.filter(k => k.startsWith(filter));
    }
    return keys;
  }

  async getDeviceFingerprint(): Promise<string> {
    return 'test-device-fingerprint';
  }

  destroy(): void {
    this._store.clear();
  }
}
