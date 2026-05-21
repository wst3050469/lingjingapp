import { writeFile, readFile, unlink, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { logger } from '../../utils/logger.js';
export class FileStorageBackend {
    type = 'filesystem';
    storageDir;
    constructor(storageDir = resolve(process.env.HOME ?? '~', '.lingjing', 'sessions')) {
        this.storageDir = storageDir;
    }
    async save(key, data) {
        await this.ensureDir();
        const filePath = this.getFilePath(key);
        const json = JSON.stringify(data, null, 2);
        await writeFile(filePath, json, 'utf-8');
    }
    async load(key) {
        const filePath = this.getFilePath(key);
        if (!existsSync(filePath))
            return null;
        try {
            const json = await readFile(filePath, 'utf-8');
            return JSON.parse(json);
        }
        catch (error) {
            logger.error(`FileStorageBackend: Failed to load ${key}:`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }
    async delete(key) {
        const filePath = this.getFilePath(key);
        if (!existsSync(filePath))
            return false;
        try {
            await unlink(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async list() {
        if (!existsSync(this.storageDir))
            return [];
        try {
            const files = await readdir(this.storageDir);
            return files
                .filter(f => f.endsWith('.json') && f !== '_index.json')
                .map(f => f.slice(0, -5));
        }
        catch {
            return [];
        }
    }
    async exists(key) {
        return existsSync(this.getFilePath(key));
    }
    async getSize(key) {
        try {
            const s = await stat(this.getFilePath(key));
            return s.size;
        }
        catch {
            return 0;
        }
    }
    getFilePath(key) {
        return join(this.storageDir, `${key}.json`);
    }
    async ensureDir() {
        if (!existsSync(this.storageDir)) {
            await mkdir(this.storageDir, { recursive: true });
        }
    }
}
//# sourceMappingURL=file-backend.js.map