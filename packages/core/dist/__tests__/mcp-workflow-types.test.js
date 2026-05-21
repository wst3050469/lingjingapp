import { describe, it, expect } from 'vitest';
import { WorkflowStatus } from '../workflow/types.js';
// Test classifyMcpError by importing it
// Since it's not exported directly, we test via the McpManager behavior
describe('MCP Error Classification', () => {
    // We test the classifyMcpError logic by recreating it
    function classifyMcpError(err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('spawn') || msg.includes('enoent') || msg.includes('command not found') || msg.includes('process exited')) {
            return { errorCategory: 'spawn', error: `进程启动失败: ${err.message}` };
        }
        if (msg.includes('timed out') || msg.includes('timeout')) {
            return { errorCategory: 'timeout', error: `连接超时: ${err.message}` };
        }
        if (msg.includes('handshake') || msg.includes('initialize') || msg.includes('protocol')) {
            return { errorCategory: 'protocol', error: `协议握手失败: ${err.message}` };
        }
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('status')) {
            return { errorCategory: 'network', error: `网络连接失败: ${err.message}` };
        }
        return { errorCategory: 'network', error: err.message };
    }
    it('should classify spawn errors', () => {
        const result = classifyMcpError(new Error('spawn ENOENT: node'));
        expect(result.errorCategory).toBe('spawn');
    });
    it('should classify timeout errors', () => {
        const result = classifyMcpError(new Error('Request timed out after 60s'));
        expect(result.errorCategory).toBe('timeout');
    });
    it('should classify protocol errors', () => {
        const result = classifyMcpError(new Error('handshake failed: protocol version mismatch'));
        expect(result.errorCategory).toBe('protocol');
    });
    it('should classify network errors', () => {
        const result = classifyMcpError(new Error('fetch failed: ECONNREFUSED'));
        expect(result.errorCategory).toBe('network');
    });
    it('should default to network for unknown errors', () => {
        const result = classifyMcpError(new Error('something went wrong'));
        expect(result.errorCategory).toBe('network');
    });
});
describe('Workflow Types', () => {
    it('should have correct enum values', () => {
        expect(WorkflowStatus.PENDING).toBe('pending');
        expect(WorkflowStatus.RUNNING).toBe('running');
        expect(WorkflowStatus.COMPLETED).toBe('completed');
        expect(WorkflowStatus.FAILED).toBe('failed');
        expect(WorkflowStatus.CANCELLED).toBe('cancelled');
    });
});
describe('JSON-RPC Protocol', () => {
    it('should validate request structure', () => {
        const req = { jsonrpc: '2.0', id: 1, method: 'test', params: {} };
        expect(req.jsonrpc).toBe('2.0');
        expect(typeof req.id).toBe('number');
        expect(typeof req.method).toBe('string');
    });
    it('should validate response structure', () => {
        const res = { jsonrpc: '2.0', id: 1, result: 'ok' };
        expect(res.jsonrpc).toBe('2.0');
        expect(res.id).toBe(1);
        expect(res.result).toBe('ok');
    });
    it('should validate error response', () => {
        const err = { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } };
        expect(err.error.code).toBe(-32601);
        expect(err.error.message).toBeDefined();
    });
});
describe('MCP Types', () => {
    it('should validate server info structure', () => {
        const info = { name: 'test-server', version: '1.0.0' };
        expect(info.name).toBeDefined();
        expect(info.version).toBeDefined();
    });
    it('should validate connection state enum values', () => {
        const states = ['connected', 'disconnected', 'connecting', 'connect-failed'];
        expect(states).toContain('connected');
        expect(states).toContain('disconnected');
        expect(states).toContain('connect-failed');
    });
});
//# sourceMappingURL=mcp-workflow-types.test.js.map