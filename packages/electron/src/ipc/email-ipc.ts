import { ipcMain } from 'electron';
import { EmailService } from '../services/email-service/smtp-client.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const emailService = new EmailService();
const CONFIG_PATH = join(homedir(), '.lingjing', 'config.json');

/** 读取 config.json */
async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch { return {}; }
}

/** 写入 config.json */
async function writeConfig(cfg: Record<string, unknown>): Promise<void> {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function registerEmailIpc(): void {
  // 保存 SMTP 配置（持久化到 config.json）
  ipcMain.handle('email:init-smtp', async (_event, config: any) => {
    try {
      emailService.init(config);
      // 持久化到 config.json
      const cfg = await readConfig();
      cfg.smtp = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass,
        fromName: config.fromName,
      };
      await writeConfig(cfg);
      return { success: true };
    } catch (error: any) {
      console.error('[Email] initSMTP error:', error);
      return { success: false, error: error.message };
    }
  });

  // 读取已保存的 SMTP 配置（同时恢复内存状态）
  ipcMain.handle('email:get-config', async () => {
    try {
      const cfg = await readConfig();
      if (cfg.smtp) {
        // 恢复 EmailService 内存状态，避免重启后发送邮件报"未初始化"
        emailService.init(cfg.smtp as any);
      }
      return { success: true, data: cfg.smtp || null };
    } catch (error: any) {
      console.error('[Email] getConfig error:', error);
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
