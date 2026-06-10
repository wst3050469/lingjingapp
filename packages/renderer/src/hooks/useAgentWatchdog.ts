import { useEffect, useRef, useCallback } from 'react';

const WARNING_THRESHOLD = 15_000;  // 15 seconds of silence → warning
const STALL_THRESHOLD = 45_000;    // 45 seconds of silence → user prompt

interface WatchdogState {
  lastEventTime: number;
  warningTimer: ReturnType<typeof setTimeout> | null;
  stallTimer: ReturnType<typeof setTimeout> | null;
  onStall: (() => void) | null;
}

/**
 * Monitors agent events to detect when the agent may be stuck/unresponsive.
 *
 * - After WARNING_THRESHOLD (15s) of silence, shows a non-blocking toast
 * - After STALL_THRESHOLD (45s) of silence, triggers onStall callback
 *
 * Usage in a component:
 *   const { reset } = useAgentWatchdog({
 *     onStall: () => { /* show dialog / abort *\/ },
 *   });
 *   // reset() is called automatically on any agent event
 */
export function useAgentWatchdog(options?: {
  onStall?: () => void;
}): { reset: () => void } {
  const stateRef = useRef<WatchdogState>({
    lastEventTime: 0,
    warningTimer: null,
    stallTimer: null,
    onStall: null,
  });

  // Keep onStall callback ref up to date
  stateRef.current.onStall = options?.onStall ?? null;

  const clearTimers = useCallback(() => {
    const s = stateRef.current;
    if (s.warningTimer) { clearTimeout(s.warningTimer); s.warningTimer = null; }
    if (s.stallTimer) { clearTimeout(s.stallTimer); s.stallTimer = null; }
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.lastEventTime = Date.now();
    clearTimers();

    // Re-arm the timers
    s.warningTimer = setTimeout(() => {
      console.warn('[Watchdog] Agent has been silent for 15s — may be slow or stuck');
      // We could show a toast here, but for now just log
    }, WARNING_THRESHOLD);

    s.stallTimer = setTimeout(() => {
      console.error('[Watchdog] Agent has been silent for 45s — likely stuck');
      stateRef.current.onStall?.();
    }, STALL_THRESHOLD);
  }, [clearTimers]);

  const onAgentEvent = useCallback((event: any) => {
    // Ignore heartbeat events for stall detection — they ARE the "alive" signal
    // But still reset on any non-heartbeat event as a bonus
    if (event.type === 'heartbeat') {
      // Heartbeat received — agent is alive, push the stall timer forward
      stateRef.current.lastEventTime = Date.now();
      clearTimers();
      stateRef.current.stallTimer = setTimeout(() => {
        console.error('[Watchdog] No heartbeat received for 45s — agent likely stuck');
        stateRef.current.onStall?.();
      }, STALL_THRESHOLD);
      return;
    }

    // Any real event: full reset
    reset();
  }, [reset, clearTimers]);

  useEffect(() => {
    try {
      const unsub = window.electronAPI.agent.onEvent(onAgentEvent);
      return () => { unsub(); clearTimers(); };
    } catch {
      // electronAPI might not be available (e.g., in tests)
      return () => {};
    }
  }, [onAgentEvent, clearTimers]);

  return { reset };
}
