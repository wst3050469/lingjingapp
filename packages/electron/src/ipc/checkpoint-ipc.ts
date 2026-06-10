import { ipcMain } from 'electron';
import { CheckpointManager, FileCheckpointStorage } from '@codepilot/core/checkpoint';
import { SnapshotCreator } from '@codepilot/core/checkpoint';
import { RollbackExecutor } from '@codepilot/core/checkpoint';
import { CheckpointCleaner } from '@codepilot/core/checkpoint';

export function registerCheckpointIPC(storageDir: string): void {
  const storage = new FileCheckpointStorage(storageDir);
  const manager = new CheckpointManager(storage);
  const snapshotCreator = new SnapshotCreator(storageDir);
  const rollbackExecutor = new RollbackExecutor();
  const cleaner = new CheckpointCleaner();

  ipcMain.handle('checkpoint:create', async (_event, files: string[], description: string) => {
    return snapshotCreator.createSnapshot(files, description);
  });

  ipcMain.handle('checkpoint:list', async () => {
    return manager.list();
  });

  ipcMain.handle('checkpoint:get', async (_event, id: string) => {
    return manager.get(id);
  });

  ipcMain.handle('checkpoint:rollback', async (_event, checkpointId: string, strategy?: 'force' | 'preserve-manual-edits') => {
    const checkpoint = await manager.get(checkpointId);
    if (!checkpoint) return { success: false, checkpointId, restoredFiles: [], conflictFiles: [], message: 'Checkpoint not found' };
    return rollbackExecutor.rollback(checkpoint, strategy);
  });

  ipcMain.handle('checkpoint:delete', async (_event, id: string) => {
    return manager.delete(id);
  });
}
