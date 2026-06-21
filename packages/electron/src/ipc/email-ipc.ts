import { ipcMain } from 'electron';
import { EmailService } from '../services/email-service/smtp-client.js';

const emailService = new EmailService();

export function registerEmailIpc(): void {
  ipcMain.handle('email:init-smtp', async (_event, config: any) => {
    try {
      emailService.init(config);
      return { success: true };
    } catch (error: any) {
      console.error('[Email] initSMTP error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:validate-config', async (_event, config: any) => {
    try {
      const result = await emailService.validateConfig(config);
      return result;
    } catch (error: any) {
      console.error('[Email] validateConfig error:', error);
      return { valid: false, error: error.message };
    }
  });

  ipcMain.handle('email:get-presets', async () => {
    try {
      const presets = emailService.getPresetList();
      return { success: true, data: presets };
    } catch (error: any) {
      console.error('[Email] getPresetList error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:send', async (_event, mailConfig: any) => {
    try {
      const result = await emailService.sendMail(mailConfig);
      return result;
    } catch (error: any) {
      console.error('[Email] sendMail error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:send-with-preset', async (_event, presetKey: string, replacements: Record<string, string>, mailConfig: any) => {
    try {
      const result = await emailService.sendWithPreset(presetKey as any, replacements, mailConfig);
      return result;
    } catch (error: any) {
      console.error('[Email] sendWithPreset error:', error);
      return { success: false, error: error.message };
    }
  });
}
