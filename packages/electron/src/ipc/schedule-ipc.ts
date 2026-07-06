/**
 * Schedule IPC — 定时任务管理 (Electron ↔ Cloud)
 * Bridges renderer ↔ cloud server schedule API
 */

import { ipcMain, BrowserWindow } from 'electron';

const CLOUD_URL = process.env.LINGJING_CLOUD_URL || 'https://www.spiritrealmz.com';
const API_KEY = process.env.LINGJING_API_KEY || process.env.LINGJING_CLOUD_API_KEY || process.env.API_KEY || '';

async function callCloud(path: string, method = 'GET', body?: any, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${CLOUD_URL}/api${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function registerScheduleIpc(win: BrowserWindow): void {
  // ── List schedules ──
  ipcMain.handle('schedule:list', async (_event, status?: string) => {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return await callCloud(`/schedules${query}`);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Get schedule by ID ──
  ipcMain.handle('schedule:get', async (_event, id: string) => {
    try {
      return await callCloud(`/schedules/${id}`);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Create schedule ──
  ipcMain.handle('schedule:create', async (_event, params: {
    name: string;
    cronExpr: string;
    actionType?: string;
    actionConfig?: any;
    maxRetries?: number;
  }) => {
    try {
      return await callCloud('/schedules', 'POST', params);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Update schedule ──
  ipcMain.handle('schedule:update', async (_event, id: string, updates: any) => {
    try {
      return await callCloud(`/schedules/${id}`, 'PUT', updates);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Delete schedule ──
  ipcMain.handle('schedule:delete', async (_event, id: string) => {
    try {
      return await callCloud(`/schedules/${id}`, 'DELETE');
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Trigger schedule immediately ──
  ipcMain.handle('schedule:trigger', async (_event, id: string) => {
    try {
      return await callCloud(`/schedules/${id}/trigger`, 'POST');
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Get execution logs ──
  ipcMain.handle('schedule:logs', async (_event, id: string, limit?: number) => {
    try {
      const limitStr = limit ? `?limit=${limit}` : '';
      return await callCloud(`/schedules/${id}/logs${limitStr}`);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // ── Webhook trigger from renderer ──
  ipcMain.handle('schedule:webhook-trigger', async (_event, channel: string, payload: any) => {
    try {
      return await callCloud(`/webhook/${encodeURIComponent(channel)}`, 'POST', payload);
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
