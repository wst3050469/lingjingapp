import { logger } from '../../utils/logger.js';
import type { IEventBus } from '../event-bus/types.js';
import type {
  ModelRouterConfig,
  RouteRule,
  TaskFeatures,
  RoutingDecision,
  Message,
} from './types.js';
import { DEFAULT_MODEL_ROUTER_CONFIG } from './types.js';

export class DynamicModelRouter {
  private config: ModelRouterConfig;
  private rules: RouteRule[] = [];
  private eventBus: IEventBus | null = null;
  private ruleCounter = 0;
  private availableModels: Set<string>;
  private healthy = true;

  constructor(
    availableModels: string[] = [],
    config?: Partial<ModelRouterConfig>,
    eventBus?: IEventBus,
  ) {
    this.config = { ...DEFAULT_MODEL_ROUTER_CONFIG, ...config };
    this.availableModels = new Set(availableModels);
    if (eventBus) this.eventBus = eventBus;
  }

  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  registerModel(model: string): void {
    this.availableModels.add(model);
  }

  evaluateTaskFeatures(messages: Message[], taskType?: string): TaskFeatures {
    const contextLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const hasToolCalls = messages.some((m) => m.role === 'tool');

    let complexity: 'low' | 'medium' | 'high';
    if (contextLength < 1000 && !hasToolCalls) {
      complexity = 'low';
    } else if (contextLength > 5000 && hasToolCalls) {
      complexity = 'high';
    } else {
      complexity = 'medium';
    }

    const estimatedCost = contextLength * 0.00001 + (hasToolCalls ? 0.05 : 0);

    return {
      taskType: taskType ?? 'general',
      complexity,
      contextLength,
      hasToolCalls,
      estimatedCost,
    };
  }

  private matchRule(features: TaskFeatures): RouteRule | null {
    const enabledRules = this.rules
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of enabledRules) {
      if (rule.taskType !== features.taskType) continue;
      if (rule.complexity !== undefined && rule.complexity !== features.complexity) continue;
      if (rule.costBudget !== undefined && features.estimatedCost > rule.costBudget) continue;
      return rule;
    }

    return null;
  }

  route(request: { model: string; messages: Message[]; taskType?: string }): RoutingDecision {
    if (!this.config.enabled) {
      return {
        requestId: this.generateId(),
        originalModel: request.model,
        selectedModel: request.model,
        matchedRule: null,
        reason: 'Router disabled',
        timestamp: Date.now(),
        fallback: false,
      };
    }

    const features = this.evaluateTaskFeatures(request.messages, request.taskType);
    const matchedRule = this.matchRule(features);
    let selectedModel: string;
    let reason: string;
    let fallback = false;

    if (matchedRule) {
      selectedModel = matchedRule.model;
      reason = `Matched rule ${matchedRule.id}: taskType=${matchedRule.taskType}`;
    } else {
      selectedModel = this.config.defaultModel;
      reason = 'No matching rule, using default model';
    }

    if (this.availableModels.size > 0 && !this.availableModels.has(selectedModel)) {
      const fallbackModel = matchedRule?.fallbackModel;
      if (fallbackModel && this.availableModels.has(fallbackModel)) {
        selectedModel = fallbackModel;
        reason += '; primary model unavailable, using fallback';
        fallback = true;
      } else if (this.availableModels.has(request.model)) {
        selectedModel = request.model;
        reason += '; selected model unavailable, falling back to original';
        fallback = true;
      } else if (this.availableModels.has(this.config.defaultModel)) {
        selectedModel = this.config.defaultModel;
        reason += '; falling back to default model';
        fallback = true;
      }

      if (fallback) {
        this.eventBus?.publish(
          'model:fallback',
          { originalModel: request.model, selectedModel, reason },
          'DynamicModelRouter',
        );
        logger.info(`[DynamicModelRouter] model fallback: ${request.model} -> ${selectedModel}`);
      }
    }

    const decision: RoutingDecision = {
      requestId: this.generateId(),
      originalModel: request.model,
      selectedModel,
      matchedRule,
      reason,
      timestamp: Date.now(),
      fallback,
    };

    if (this.config.auditLogEnabled) {
      logger.info(`[DynamicModelRouter] routing decision: ${JSON.stringify(decision)}`);
    }

    return decision;
  }

  addRule(rule: Omit<RouteRule, 'id'>): RouteRule {
    const id = `rule_${++this.ruleCounter}_${Date.now()}`;
    const newRule: RouteRule = { ...rule, id };
    this.rules.push(newRule);
    return newRule;
  }

  removeRule(id: string): boolean {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  getRules(): RouteRule[] {
    return [...this.rules];
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  healthCheck(): { healthy: boolean; rulesCount: number } {
    return { healthy: this.healthy, rulesCount: this.rules.length };
  }
}
