import { useState, useEffect, useCallback } from 'react';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  forced?: boolean;
  channel?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'updated'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdateErrorDetail {
  errorCode?: string;
  userMessage?: string;
  technicalDetail?: string;
  actions?: string[];
  message: string;
}

export interface UpdateState {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  errorDetail: UpdateErrorDetail | null;
  retryCount: number;
  forceUpgrade: { version: string; message: string } | null;
  rollbackSuggested: { currentVersion: string; lastKnownGood: string } | null;
}

const initialState: UpdateState = {
  phase: 'idle',
  info: null,
  progress: null,
  error: null,
  errorDetail: null,
  retryCount: 0,
  forceUpgrade: null,
  rollbackSuggested: null,
};

const SUPPRESS_KEY = 'lingjing_update_suppress';
const SUPPRESS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function isSuppressed(version: string): boolean {
  try {
    const raw = localStorage.getItem(SUPPRESS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== version) return false;
    return (Date.now() - data.timestamp) < SUPPRESS_DURATION;
  } catch { return false; }
}

function saveSuppress(version: string): void {
  localStorage.setItem(SUPPRESS_KEY, JSON.stringify({ version, timestamp: Date.now() }));
}

const ERROR_ACTION_LABELS: Record<string, string> = {
  retry: '重试',
  'skip-version': '跳过此版本',
};

export function useAutoUpdate() {
  const [state, setState] = useState<UpdateState>(initialState);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      window.electronAPI.update.onChecking(() => {
        setState(s => ({ ...s, phase: 'checking', error: null, errorDetail: null }));
      })
    );

    unsubs.push(
      window.electronAPI.update.onAvailable((info: UpdateInfo) => {
        // Suppress notification if this version was dismissed within 24h
        if (!info.forced && isSuppressed(info.version)) {
          console.log('[update] v' + info.version + ' suppressed (dismissed within 24h)');
          return;
        }
        setState(s => ({ ...s, phase: 'available', info, error: null, errorDetail: null }));
        if (info.forced) {
          setState(s => ({
            ...s,
            forceUpgrade: { version: info.version, message: `版本 ${info.version} 为强制升级` },
          }));
        }
      })
    );

    unsubs.push(
      window.electronAPI.update.onNotAvailable(() => {
        setState(s => ({ ...s, phase: 'updated', info: null }));
      })
    );

    unsubs.push(
      window.electronAPI.update.onProgress((progress: UpdateProgress) => {
        setState(s => ({ ...s, phase: 'downloading', progress }));
      })
    );

    unsubs.push(
      window.electronAPI.update.onDownloaded((info: UpdateInfo) => {
        setState(s => ({
          ...s,
          phase: 'downloaded',
          info: { ...s.info, ...info },
          progress: null,
          retryCount: 0,
        }));
      })
    );

    unsubs.push(
      window.electronAPI.update.onError((err: UpdateErrorDetail) => {
        console.warn('[update] Error received:', err);
        // Pass error details to UI so users can see and diagnose issues
        const errorMessage = err.userMessage || err.message || '更新检查失败';
        setState(s => ({
          ...s,
          phase: 'error',
          info: null,
          error: errorMessage,
          errorDetail: err,
        }));
      })
    );

    return () => unsubs.forEach(fn => fn());
  }, []);

  const checkForUpdates = useCallback(async () => {
    setState(s => ({ ...s, phase: 'checking', error: null, errorDetail: null }));
    try {
      await window.electronAPI.update.check();
    } catch (err: any) {
      setState(s => ({ ...s, phase: 'error', error: err.message || '检查更新失败' }));
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setState(s => ({ ...s, phase: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }, error: null, errorDetail: null, retryCount: 0 }));
    try {
      const downloadPromise = window.electronAPI.update.download();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('下载超时，请检查网络连接后重试')), 300000)
      );
      const result = await Promise.race([downloadPromise, timeoutPromise]);
      if (result?.error) {
        throw new Error(result.error);
      }
    } catch (err: any) {
      const msg = err.message || '下载失败';
      setState(s => ({ ...s, phase: 'error', error: msg }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setState(s => ({ ...s, phase: 'installing' }));
    try {
      await window.electronAPI.update.install();
    } catch (err: any) {
      setState(s => ({ ...s, phase: 'error', error: err.message || '安装失败' }));
    }
  }, []);

  const dismiss = useCallback(() => {
    if (state.phase !== 'downloading' && state.phase !== 'installing') {
      setState(s => ({
        ...s,
        phase: 'idle',
        info: null,
        error: null,
        errorDetail: null,
        forceUpgrade: null,
        retryCount: 0,
      }));
    }
  }, [state.phase]);

  /** Dismiss and suppress this version for 24h ("稍后提醒") */
  const dismissAndSuppress = useCallback(() => {
    if (state.info?.version) {
      saveSuppress(state.info.version);
    }
    dismiss();
  }, [state.info?.version, dismiss]);

  return {
    ...state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismiss,
    dismissAndSuppress,
    ERROR_ACTION_LABELS,
  };
}
