import { ref, onUnmounted } from 'vue';

export interface SSEOptions {
  url: string;
  token: string;
  onMessage: (data: any) => void;
  onError?: () => void;
  onReconnect?: () => void;
  maxRetryInterval?: number;
  pollingFallback?: { url: string; interval: number };
}

export function useSSE(options: SSEOptions) {
  const connected = ref(false);
  const usingPolling = ref(false);
  let eventSource: EventSource | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  const maxRetry = options.maxRetryInterval ?? 60000;

  function getRetryDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, retryCount), maxRetry);
    retryCount++;
    return delay;
  }

  function connect(): void {
    disconnect();
    const url = `${options.url}?token=${encodeURIComponent(options.token)}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      connected.value = true;
      usingPolling.value = false;
      retryCount = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage(data);
      } catch {
        options.onMessage(event.data);
      }
    };

    eventSource.onerror = () => {
      connected.value = false;
      eventSource?.close();
      eventSource = null;
      options.onError?.();
      options.onReconnect?.();
      if (options.pollingFallback) {
        startPolling();
      } else {
        retryTimer = setTimeout(connect, getRetryDelay());
      }
    };
  }

  async function startPolling(): Promise<void> {
    usingPolling.value = true;
    connected.value = true;
    const fallback = options.pollingFallback!;
    const doPoll = async () => {
      try {
        const res = await fetch(`${fallback.url}?token=${encodeURIComponent(options.token)}`);
        const data = await res.json();
        options.onMessage(data);
      } catch { /* ignore */ }
    };
    await doPoll();
    pollingTimer = setInterval(doPoll, fallback.interval);
  }

  function disconnect(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    connected.value = false;
    usingPolling.value = false;
  }

  onUnmounted(disconnect);

  return { connected, usingPolling, connect, disconnect };
}