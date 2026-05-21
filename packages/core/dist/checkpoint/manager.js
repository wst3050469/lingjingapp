import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
export class FileCheckpointStorage {
    storageDir;
    constructor(storageDir) {
        this.storageDir = storageDir;
        if (!existsSync(storageDir)) {
            mkdirSync(storageDir, { recursive: true });
        }
    }
    async save(checkpoint) {
        const filePath = join(this.storageDir, `${checkpoint.id}.json`);
        const data = JSON.stringify(checkpoint, null, 2);
        writeFileSync(filePath, data, 'utf-8');
    }
    async load(id) {
        const filePath = join(this.storageDir, `${id}.json`);
        if (!existsSync(filePath)) {
            return null;
        }
        const data = readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    async list() {
        const files = readdirSync(this.storageDir);
        const checkpoints = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = join(this.storageDir, file);
                const data = readFileSync(filePath, 'utf-8');
                checkpoints.push(JSON.parse(data));
            }
        }
        return checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    async delete(id) {
        const filePath = join(this.storageDir, `${id}.json`);
        if (existsSync(filePath)) {
            const { unlinkSync } = await import('fs');
            unlinkSync(filePath);
            return true;
        }
        return false;
    }
}
export class CheckpointManager {
    storage;
    hooksManager;
    constructor(storage, hooksManager) {
        this.storage = storage;
        this.hooksManager = hooksManager;
    }
    async create(files, description, metadata) {
        const id = this.generateId();
        const checkpointFiles = [];
        for (const filePath of files) {
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                const hash = this.hashContent(content);
                const stats = statSync(filePath);
                checkpointFiles.push({
                    path: filePath,
                    content,
                    hash,
                    size: stats.size,
                });
            }
        }
        const checkpoint = {
            id,
            timestamp: new Date(),
            description,
            files: checkpointFiles,
            metadata,
        };
        await this.storage.save(checkpoint);
        if (this.hooksManager) {
            await this.hooksManager.trigger('onCheckpointCreate', {
                workingDirectory: '',
                timestamp: checkpoint.timestamp,
                checkpointId: checkpoint.id,
                description,
                fileCount: checkpointFiles.length,
            });
        }
        return checkpoint;
    }
    async restore(id) {
        const checkpoint = await this.storage.load(id);
        if (!checkpoint) {
            return {
                success: false,
                message: `Checkpoint not found: ${id}`,
                restoredFiles: [],
            };
        }
        const restoredFiles = [];
        for (const file of checkpoint.files) {
            try {
                writeFileSync(file.path, file.content, 'utf-8');
                restoredFiles.push(file.path);
            }
            catch (error) {
                console.error(`Failed to restore file ${file.path}:`, error);
            }
        }
        if (this.hooksManager) {
            await this.hooksManager.trigger('onCheckpointRestore', {
                workingDirectory: '',
                timestamp: new Date(),
                checkpointId: id,
                restoredFiles,
            });
        }
        return {
            success: true,
            message: `Restored ${restoredFiles.length} files from checkpoint ${id}`,
            restoredFiles,
        };
    }
    async list() {
        return this.storage.list();
    }
    async delete(id) {
        return this.storage.delete(id);
    }
    async get(id) {
        return this.storage.load(id);
    }
    generateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `cp_${timestamp}_${random}`;
    }
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    async createBeforeEdit(filePath, description) {
        return this.create([filePath], description || `Before editing ${filePath}`, { type: 'before-edit', file: filePath });
    }
    async getHistory(limit = 10) {
        const all = await this.list();
        return all.slice(0, limit);
    }
    async timeTravel(id) {
        return this.restore(id);
    }
}
export function createCheckpointManager(storageDir, hooksManager) {
    const storage = new FileCheckpointStorage(storageDir);
    return new CheckpointManager(storage, hooksManager);
}
//# sourceMappingURL=manager.js.map