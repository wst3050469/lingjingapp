import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { webSocketGateway } from './websocket-gateway.js';

const logger = createLogger('push-notification-bridge');

export class PushNotificationBridge extends EventEmitter {
  onApprovalRequest(sessionId: string, request: { type: string; message: string }): void {
    logger.info('Approval request → push notification', { sessionId });
    this.emit('push-needed', {
      type: 'approval' as const,
      sessionId,
      title: 'Agent 需要审批',
      summary: request.message.slice(0, 200),
    });
  }

  onQuestionRequest(sessionId: string, question: { text: string }): void {
    logger.info('Question request → push notification', { sessionId });
    this.emit('push-needed', {
      type: 'question' as const,
      sessionId,
      title: 'Agent 提问',
      summary: question.text.slice(0, 200),
    });
  }

  onInstructionWait(sessionId: string, context: string): void {
    logger.info('Instruction wait → push notification', { sessionId });
    this.emit('push-needed', {
      type: 'instruction_wait' as const,
      sessionId,
      title: 'Agent 等待指令',
      summary: context.slice(0, 200),
    });
  }
}

export const pushNotificationBridge = new PushNotificationBridge();