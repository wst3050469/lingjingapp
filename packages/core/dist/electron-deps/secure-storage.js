// Secure token storage - stub implementation
// Real implementation uses Electron's safeStorage API in the main process
export class SecureTokenStorage {
    _store = new Map();
    async saveToken(key, value) {
        this._store.set(key, value);
    }
    async loadToken(key) {
        return this._store.get(key) ?? null;
    }
    async deleteToken(key) {
        return this._store.delete(key);
    }
    listKeys(filter) {
        const keys = Array.from(this._store.keys());
        if (filter) {
            return keys.filter(k => k.startsWith(filter));
        }
        return keys;
    }
    async getDeviceFingerprint() {
        return 'test-device-fingerprint';
    }
    destroy() {
        this._store.clear();
    }
}
//# sourceMappingURL=secure-storage.js.map