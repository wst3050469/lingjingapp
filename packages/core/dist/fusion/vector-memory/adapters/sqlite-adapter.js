export class SqliteVectorAdapter {
    db;
    tableName;
    store = new Map();
    loaded = false;
    constructor(db, tableName = 'vector_memory_store') {
        this.db = db;
        this.tableName = tableName;
    }
    async initialize() {
        if (!this.db)
            return;
        try {
            const createSQL = `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        metadata TEXT DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      )`;
            this.db.run(createSQL);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_id ON ${this.tableName}(id)`);
            await this.loadAll();
            this.loaded = true;
            console.log(`[SqliteVectorAdapter] Loaded ${this.store.size} vectors from ${this.tableName}`);
        }
        catch (err) {
            console.warn('[SqliteVectorAdapter] Initialize failed, running in memory-only mode:', err instanceof Error ? err.message : String(err));
        }
    }
    async upsert(id, vector, metadata) {
        this.store.set(id, { id, vector, metadata });
        if (!this.db)
            return;
        try {
            const vectorBlob = Buffer.from(new Float64Array(vector).buffer);
            const metaJson = JSON.stringify(metadata);
            this.db.run(`INSERT OR REPLACE INTO ${this.tableName} (id, vector, metadata, updated_at) VALUES (?, ?, ?, datetime('now'))`, [id, vectorBlob, metaJson]);
        }
        catch (err) {
            console.warn('[SqliteVectorAdapter] Upsert failed:', err instanceof Error ? err.message : String(err));
        }
    }
    async search(queryVector, topK) {
        const results = [];
        for (const entry of this.store.values()) {
            const score = cosineSimilarity(queryVector, entry.vector);
            if (score > 0) {
                // @ts-ignore -- content field not populated in this adapter implementation
                results.push({
                    id: entry.id,
                    score,
                    metadata: entry.metadata,
                });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }
    async delete(id) {
        this.store.delete(id);
        if (!this.db)
            return;
        try {
            this.db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
        }
        catch (err) {
            console.warn('[SqliteVectorAdapter] Delete failed:', err instanceof Error ? err.message : String(err));
        }
    }
    async loadAll() {
        if (!this.db)
            return;
        try {
            const rows = this.db.exec(`SELECT id, vector, metadata FROM ${this.tableName}`);
            if (!rows || !rows[0] || !rows[0].values)
                return;
            for (const [id, vectorBlob, metaJson] of rows[0].values) {
                try {
                    const float64 = new Float64Array(vectorBlob.buffer, vectorBlob.byteOffset, vectorBlob.byteLength / 8);
                    const vector = Array.from(float64);
                    const metadata = JSON.parse(metaJson || '{}');
                    this.store.set(id, { id, vector, metadata });
                }
                catch { /* skip corrupt entries */ }
            }
        }
        catch (err) {
            console.warn('[SqliteVectorAdapter] Load failed:', err instanceof Error ? err.message : String(err));
        }
    }
    get size() {
        return this.store.size;
    }
}
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
//# sourceMappingURL=sqlite-adapter.js.map