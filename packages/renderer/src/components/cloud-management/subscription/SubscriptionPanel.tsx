import { useState, useEffect } from 'react';
import type { Subscription, Plan } from '@lingjing/core';
import { Button, Card, Badge, LoadingSpinner, EmptyState, SectionHeader, Progress } from '../common/components';

export function SubscriptionPanel() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, plansData] = await Promise.all([
        window.electronAPI.cloudManagement.subscription.get(),
        window.electronAPI.cloudManagement.subscription.getPlans(),
      ]);
      setSubscription(subData);
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="订阅管理" />

      {subscription && (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-cp-text">{subscription.planName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
                  {subscription.status === 'active' ? '活跃' : subscription.status}
                </Badge>
              </div>
              <p className="text-xs text-white/50 mt-2">
                到期时间: {new Date(subscription.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                await window.electronAPI.cloudManagement.subscription.cancel();
                loadData();
              }}
            >
              取消订阅
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-cp-text mb-3">功能使用情况</h4>
            <div className="space-y-3">
              {subscription.features.map((feature) => {
                const limit = feature.limit === 'unlimited' ? Infinity : feature.limit;
                return (
                  <div key={feature.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-white/70">{feature.name}</span>
                      <span className="text-cp-text">
                        {feature.used} / {feature.limit === 'unlimited' ? '∞' : feature.limit}
                      </span>
                    </div>
                    {feature.limit !== 'unlimited' && (
                      <Progress value={feature.used} max={feature.limit} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <SectionHeader title="可用套餐" />

      <div className="grid grid-cols-2 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.recommended ? 'border-primary-500' : ''} hover>
            {plan.recommended && (
              <div className="mb-3">
                <Badge variant="info">推荐</Badge>
              </div>
            )}
            <h4 className="text-lg font-medium text-cp-text">{plan.name}</h4>
            <p className="text-2xl font-bold text-cp-text mt-2">
              ¥{plan.price}
              <span className="text-xs font-normal text-white/50">
                /{plan.billingCycle === 'monthly' ? '月' : '年'}
              </span>
            </p>
            <div className="mt-3 space-y-1">
              {plan.features.slice(0, 3).map((feature) => (
                <p key={feature.name} className="text-xs text-white/50">
                  {feature.included ? '✓' : '✗'} {feature.name}
                </p>
              ))}
            </div>
            <Button
              className="mt-4 w-full"
              onClick={async () => {
                await window.electronAPI.cloudManagement.subscription.subscribe({
                  planId: plan.id,
                  billingCycle: plan.billingCycle,
                });
                loadData();
              }}
            >
              选择套餐
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
