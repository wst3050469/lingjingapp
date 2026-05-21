export interface ModelRouterConfig {
    enabled: boolean;
    defaultModel: string;
    auditLogEnabled: boolean;
}
export interface RouteRule {
    id: string;
    taskType: string;
    complexity?: 'low' | 'medium' | 'high';
    model: string;
    costBudget?: number;
    fallbackModel?: string;
    priority: number;
    enabled: boolean;
}
export interface TaskFeatures {
    taskType: string;
    complexity: 'low' | 'medium' | 'high';
    contextLength: number;
    hasToolCalls: boolean;
    estimatedCost: number;
}
export interface RoutingDecision {
    requestId: string;
    originalModel: string;
    selectedModel: string;
    matchedRule: RouteRule | null;
    reason: string;
    timestamp: number;
    fallback: boolean;
}
export interface IDynamicModelRouter {
    route(request: {
        model: string;
        messages: Message[];
        taskType?: string;
    }): RoutingDecision;
    evaluateTaskFeatures(messages: Message[], taskType?: string): TaskFeatures;
    addRule(rule: Omit<RouteRule, 'id'>): RouteRule;
    removeRule(id: string): boolean;
    getRules(): RouteRule[];
    healthCheck(): {
        healthy: boolean;
        rulesCount: number;
    };
}
export interface Message {
    role: 'user' | 'assistant' | 'tool';
    content: string;
}
export type RouterMessage = Message;
export declare const DEFAULT_MODEL_ROUTER_CONFIG: ModelRouterConfig;
//# sourceMappingURL=types.d.ts.map