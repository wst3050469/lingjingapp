// 灵境 Cloud 类型定义
// Cloud types for sync client

export interface CloudServerConfig {
    url: string;
    apiKey: string;
    enabled: boolean;
    syncInterval?: number;
}

export interface CloudSession {
    id: string;
    title: string;
    messages: CloudMessage[];
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface CloudMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: any[];
    tool_results?: any[];
    timestamp?: string;
}

export interface CloudMemory {
    id: string;
    title: string;
    content: string;
    category: string;
    scope: 'global' | 'project';
    created_at: string;
    updated_at: string;
}

export interface WebhookPayload {
    id: string;
    channel: string;
    payload: any;
    received_at: string;
}

export interface CloudSyncEvent {
    type: 'session_updated' | 'memory_updated' | 'webhook' | 'connected' | 'disconnected';
    payload?: any;
    timestamp: string;
}
