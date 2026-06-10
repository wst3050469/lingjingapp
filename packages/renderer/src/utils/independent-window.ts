/**
 * Stub: Independent chat window launcher.
 * Will open a separate Electron BrowserWindow for chat in a future iteration.
 * For now, provides the interface and a no-op implementation.
 */

export interface IndependentWindowOptions {
  conversationId?: string;
  mode?: 'ask' | 'agent';
}

/**
 * Request to open an independent chat window.
 * Currently a no-op stub - will be implemented via IPC to main process.
 */
export async function openIndependentChatWindow(_options?: IndependentWindowOptions): Promise<void> {
  console.info('[IndependentWindow] Stub: independent chat window not yet implemented');
}

/**
 * Check if independent windows feature is available.
 */
export function isIndependentWindowSupported(): boolean {
  return false;
}
