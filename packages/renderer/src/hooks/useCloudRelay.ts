// Cloud Relay Handler — processes mobile→cloud→desktop relay messages
// Listens for cloud:relay-message events and routes them to the AI agent
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chat-store';

export function useCloudRelay(): void {
  const processingRef = useRef(false);
  const pendingCorrelationId = useRef<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.cloud?.onRelayMessage) return;
    if (!window.electronAPI?.agent?.onEvent) return;

    // Listen for incoming relay messages from mobile via cloud
    const unsubRelay = window.electronAPI.cloud.onRelayMessage(async (data: any) => {
      const payload = data?.payload;
      if (!payload || payload.type !== 'chat:send') return;

      const { conversationId, message } = payload;
      const correlationId = data?.correlationId;
      if (!message) return;

      console.log('[CloudRelay] Mobile message:', message.slice(0, 80), 'cid:', correlationId);

      if (processingRef.current) {
        console.warn('[CloudRelay] Already processing, ignoring duplicate');
        return;
      }

      processingRef.current = true;
      pendingCorrelationId.current = correlationId;

      try {
        const chatStore = useChatStore.getState();
        let convId = conversationId || chatStore.currentConversationId;

        // Create new conversation if needed
        if (!convId) {
          chatStore.createNewConversation();
          // Small delay to let store settle
          await new Promise(r => setTimeout(r, 100));
          convId = chatStore.currentConversationId;
        }

        if (!convId) {
          sendRelayError(correlationId, 'No conversation available');
          processingRef.current = false;
          return;
        }

        // Switch to the target conversation
        if (chatStore.currentConversationId !== convId) {
          await chatStore.loadConversation(convId);
        }

        // Send to AI agent
        await window.electronAPI.agent.run(message, {
          mode: 'chat',
          conversationId: convId,
          conversationMessages: useChatStore.getState().messages,
        });
      } catch (err: any) {
        console.error('[CloudRelay] Agent run error:', err?.message || err);
        sendRelayError(correlationId, err?.message || 'Agent error');
        processingRef.current = false;
      }
    });

    // Watch agent events for completion
    const unsubAgent = window.electronAPI.agent.onEvent((event: any) => {
      if (!processingRef.current) return;

      if (event?.type === 'done') {
        const chatStore = useChatStore.getState();
        const msgs = chatStore.messages;
        const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
        const response = lastAssistant?.content || '';

        console.log('[CloudRelay] AI done, response:', response.slice(0, 80));

        const cid = pendingCorrelationId.current;
        if (cid && response) {
          window.electronAPI.cloud.relaySend({
            type: 'relay:to-mobile',
            payload: { type: 'chat:response', conversationId: chatStore.currentConversationId, content: response },
            correlationId: cid,
          }).catch((e: Error) => console.error('[CloudRelay] relaySend error:', e));
        }

        processingRef.current = false;
        pendingCorrelationId.current = null;
      }

      if (event?.type === 'error' && processingRef.current) {
        sendRelayError(pendingCorrelationId.current!, event?.error || 'Unknown error');
        processingRef.current = false;
        pendingCorrelationId.current = null;
      }
    });

    return () => {
      unsubRelay();
      unsubAgent();
    };
  }, []);
}

function sendRelayError(correlationId: string | null, error: string) {
  if (!correlationId) return;
  window.electronAPI.cloud.relaySend({
    type: 'relay:to-mobile',
    payload: { type: 'chat:error', error },
    correlationId,
  }).catch(() => {});
}
