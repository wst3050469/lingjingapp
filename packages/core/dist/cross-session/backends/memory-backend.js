export class MemoryStorageBackend {
    type = 'memory';
    store = new Map();
    async save(key, data) {
        this.store.set(key, data);
    }
    async load(key) {
        return this.store.get(key) ?? null;
    }
    async delete(key) {
        return this.store.delete(key);
    }
    async list() {
        return Array.from(this.store.keys());
    }
    async exists(key) {
        return this.store.has(key);
    }
    clear() {
        this.store.clear();
    }
    get size() {
        return this.store.size;
    }
}
//# sourceMappingURL=memory-backend.js.map