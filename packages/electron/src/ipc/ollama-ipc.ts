// Ollama IPC - list available models from local Ollama instance

import { ipcMain } from 'electron';

export interface OllamaModel {
  name: string;
  size: number;
  modifiedAt: string;
}

export function registerOllamaIpc(ollamaBaseUrl: string = 'http://localhost:11434'): void {
  ipcMain.handle('ollama:list-models', async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${ollamaBaseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return { models: [], error: `Ollama returned ${res.status}` };
      }

      const data = await res.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
      const models: OllamaModel[] = (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
      }));

      return { models, error: null };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { models: [], error: 'Ollama connection timeout' };
      }
      return { models: [], error: `Ollama not running: ${err.message}` };
    }
  });
}
