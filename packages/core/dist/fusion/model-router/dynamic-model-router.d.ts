import type { IEventBus } from '../event-bus/types.js';
import type { ModelRouterConfig, RouteRule, TaskFeatures, RoutingDecision, Message } from './types.js';
export declare class DynamicModelRouter {
    private config;
    private rules;
    private eventBus;
    private ruleCounter;
    private availableModels;
    private healthy;
    constructor(availableModels?: string[], config?: Partial<ModelRouterConfig>, eventBus?: IEventBus);
    setEventBus(eventBus: IEventBus): void;
    registerModel(model: string): void;
    evaluateTaskFeatures(messages: Message[], taskType?: string): TaskFeatures;
    private matchRule;
    route(request: {
        model: string;
        messages: Message[];
        taskType?: string;
    }): RoutingDecision;
    addRule(rule: Omit<RouteRule, 'id'>): RouteRule;
    removeRule(id: string): boolean;
    getRules(): RouteRule[];
    private generateId;
    healthCheck(): {
        healthy: boolean;
        rulesCount: number;
    };
}
//# sourceMappingURL=dynamic-model-router.d.ts.map