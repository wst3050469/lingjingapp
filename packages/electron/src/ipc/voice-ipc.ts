import { ipcMain, BrowserWindow } from 'electron';
import type { VoiceEngineManager } from '../voice/voice-engine-manager.js';

export function registerVoiceIPC(engineManager: VoiceEngineManager): void {
  ipcMain.handle('voice:engine:getAvailability', async () => {
    return engineManager.getAvailability();
  });

  ipcMain.handle('voice:engine:getConfig', async () => {
    return engineManager.getConfig();
  });

  ipcMain.handle('voice:engine:updateConfig', async (_e, config: Record<string, unknown>) => {
    engineManager.updateConfig(config);
    return { success: true };
  });

  ipcMain.handle('voice:engine:setASREngine', async (_e, type: string) => {
    const adapter = await engineManager.getASRAdapter(type as any);
    return { success: adapter !== null, available: adapter !== null };
  });

  ipcMain.handle('voice:engine:setTTSEngine', async (_e, type: string) => {
    const adapter = await engineManager.getTTSAdapter(type as any);
    return { success: adapter !== null, available: adapter !== null };
  });

  ipcMain.handle('voice:asr:start', async () => {
    const asr = await engineManager.getASRAdapter();
    if (asr) {
      asr.onResult((result) => {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('voice:asr:result', result));
      });
      await asr.start();
      return { success: true };
    }
    return { success: false, error: 'No ASR engine available' };
  });

  ipcMain.handle('voice:asr:stop', async () => {
    const asr = await engineManager.getASRAdapter();
    if (asr) await asr.stop();
    return { success: true };
  });

  ipcMain.handle('voice:asr:abort', async () => {
    const asr = await engineManager.getASRAdapter();
    if (asr) await asr.abort();
    return { success: true };
  });

  ipcMain.handle('voice:tts:speak', async (_e, text: string) => {
    const tts = await engineManager.getTTSAdapter();
    if (tts) {
      const handle = await tts.speak(text);
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('voice:tts:stateChange', 'speaking'));
      handle.onDone.then(() => {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('voice:tts:stateChange', 'idle'));
      });
      return { success: true };
    }
    return { success: false, error: 'No TTS engine available' };
  });

  ipcMain.handle('voice:tts:stop', async () => {
    const tts = await engineManager.getTTSAdapter();
    if (tts) await tts.stop();
    return { success: true };
  });

  ipcMain.handle('voice:tts:pause', async () => {
    const tts = await engineManager.getTTSAdapter();
    if (tts) await tts.pause();
    return { success: true };
  });

  ipcMain.handle('voice:tts:resume', async () => {
    const tts = await engineManager.getTTSAdapter();
    if (tts) await tts.resume();
    return { success: true };
  });

  ipcMain.handle('voice:permission:checkMicrophone', async () => {
    return { granted: true };
  });

  ipcMain.handle('voice:permission:requestMicrophone', async () => {
    return { granted: true };
  });
}
