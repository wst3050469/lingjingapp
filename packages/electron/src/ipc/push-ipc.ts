import { ipcMain } from 'electron';
import { pushNotificationBridge } from '../services/push-notification-bridge.js';
import { getDatabase, saveDatabase } from '../db/database.js';

export function registerPushIpc(): void {
  ipcMain.handle('push:register-device', async (_event, { deviceType, deviceName, pushToken }: {
    deviceType: 'ios' | 'android';
    deviceName: string;
    pushToken: string;
  }) => {
    try {
      const db = getDatabase();
      const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      db.run(
        `INSERT OR REPLACE INTO device_registrations (id, user_id, device_type, device_name, push_token, is_active, last_connected_at, created_at, updated_at)
         VALUES (?, 'local', ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))`,
        [id, deviceType, deviceName, pushToken],
      );
      await saveDatabase();
      return { success: true, deviceId: id };
    } catch (err) {
      console.error('push:register-device error:', err);
      return { success: false, error: String(err) };
    }
  });
}