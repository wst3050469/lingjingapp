import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { webSocketGateway } from './websocket-gateway.js';

const logger = createLogger('approval-bridge');

export class ApprovalBridge extends EventEmitter {
  forwardApproval(sessionId: string, approvalRequest: { type: string; message: string; options: string[] }): void {
    logger.info('Forwarding approval to mobile', { sessionId, type: approvalRequest.type });
    webSocketGateway.broadcastToMobile({
      type: 'push',
      channel: 'approval',
      event: 'request',
      data: { sessionId, ...approvalRequest },
    });
    this.emit('approval-forwarded', { sessionId });
  }

  receiveApproval(sessionId: string, approved: boolean): void {
    logger.info('Received approval from mobile', { sessionId, approved });
    this.emit('approval-received', { sessionId, approved });
  }

  forwardQuestion(sessionId: string, question: { text: string; options?: string[] }): void {
    logger.info('Forwarding question to mobile', { sessionId });
    webSocketGateway.broadcastToMobile({
      type: 'push',
      channel: 'approval',
      event: 'question',
      data: { sessionId, ...question },
    });
    this.emit('question-forwarded', { sessionId });
  }
}

export const approvalBridge = new ApprovalBridge();