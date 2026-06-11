import { useState, useEffect } from 'react';
import { Check, X, Shield, AlertTriangle, Star, History } from 'lucide-react';

/* Types */
interface Plan {
  id: string;
  name: string;
  price: number;
  billingCycle: string;
  recommended: boolean;
  features: { name: string; desc?: string; included: boolean }[];
  limits: Record<string, any>;
}

interface SubscriptionInfo {
  id: string | null;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  price: number;
  features: { name: string; desc?: string; included: boolean }[];
  limits: Record<string, any>;
  usage?: { apiCalls: number; storageFiles: number; apiKeys: number; sessions: number; memories: number };
}

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
}

function formatBytes(mb: number) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return mb + ' MB';
}

export function SubscriptionTab() {
  const [currentSub, setCurrentSub] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'upgrade' | 'cancel'; planId?: string; planName?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subData, plansData] = await Promise.all([
        window.electronAPI.cloudManagement.subscription.get().catch(() => null),
        window.electronAPI.cloudManagement.subscription.getPlans().catch(() => []),
      ]);
      setCurrentSub(subData);
      setPlans(plansData);

      // Try to load payments too
      window.electronAPI.cloudManagement.subscription.getPayments()
        .then(setPayments)
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || '加载订阅数据失败');
    } finally {
      setLoading(false);
    }
  };

    const handleUpgrade = async (planId: string) => {
    setActionLoading(true);
    try {
      console.log('[Subscription] Upgrading to plan:', planId);
      const result = await window.electronAPI.cloudManagement.subscription.upgrade(planId);
      console.log('[Subscription] Upgrade result:', result);
      setConfirmDialog(null);
      await loadData();
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || '未知错误';
      const errorCode = err?.code || '';
      const errorDetails = err?.details || '';
      console.error('[Subscription] Upgrade failed:', {
        planId,
        error: err,
        message: errorMsg,
        code: errorCode,
        details: errorDetails,
        stack: err?.stack
      });
      // Build contextual suggestions
      const suggestions = [];
      if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorCode.includes('auth')) {
        suggestions.push('• 登录凭证已过期，请重新登录');
      } else if (errorMsg.includes('404') || errorCode.includes('not_found')) {
        suggestions.push('• 所选套餐不存在，请刷新后重试');
      } else if (errorMsg.includes('400') || errorMsg.includes('Missing') || errorCode.includes('plan_id')) {
        suggestions.push('• 请求参数异常，请刷新后重试');
      } else if (errorMsg.includes('500') || errorCode.includes('internal')) {
        suggestions.push('• 服务器内部错误，请稍后重试');
      } else {
        suggestions.push('• 网络连接是否正常');
        suggestions.push('• 云服务器是否可达');
        suggestions.push('• 登录状态是否有效');
      }
      const detailInfo = errorDetails ? '\n\n服务器详情: ' + errorDetails : '';
      const codeInfo = errorCode ? '\n错误代码: ' + errorCode : '';
      alert('操作失败: ' + errorMsg + codeInfo + detailInfo + '\n\n建议:\n' + suggestions.join('\n'));
    } finally {
      setActionLoading(false);
    }
  };

const handleCancel = async () => {
    setActionLoading(true);
    try {
      await window.electronAPI.cloudManagement.subscription.cancel();
      setConfirmDialog(null);
      await loadData();
    } catch (err: any) {
      alert('取消失败: ' + (err.message || '未知错误'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <AlertTriangle size={48} className="text-yellow-400 mb-4" />
        <p className="text-gray-400 mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-accent-primary/20 text-accent-primary rounded-lg hover:bg-accent-primary/30">
          重新加载
        </button>
      </div>
    );
  }

  const currentPlanId = currentSub?.planId || 'free';
  const currentPlanTier = plans.findIndex(p => p.id === currentPlanId);
  const isFree = currentPlanId === 'free' || !currentSub?.id;

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <div className="p-4 bg-dark-700/50 rounded-lg border border-accent-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-cp-text">
              当前套餐: {currentSub?.planName || '免费版'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              状态: <span className={currentSub?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                {currentSub?.status === 'active' ? '活跃' : currentSub?.status || '免费试用'}
              </span>
              {currentSub?.autoRenew && currentSub?.status === 'active' && (
                <span className="text-gray-500 ml-2">(自动续费)</span>
              )}
            </p>
            {currentSub?.endDate && (
              <p className="text-xs text-gray-500 mt-1">
                到期: {new Date(currentSub.endDate).toLocaleDateString('zh-CN')}
              </p>
            )}
            {currentSub?.usage && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(currentSub.usage).map(([key, value]) => {
                  const limit = currentSub.limits?.[key === 'apiCalls' ? 'apiCalls' : key] || 100;
                  const pct = Math.min(100, ((value as number) / limit) * 100);
                  return (
                    <div key={key} className="text-xs">
                      <span className="text-gray-500">{key}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: pct + '%' }} />
                        </div>
                        <span className="text-white/70">{value as number}/{limit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {!isFree && (
            <button onClick={() => setConfirmDialog({ type: 'cancel' })}
              className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
              取消订阅
            </button>
          )}
        </div>
      </div>

      {/* Plan Cards */}
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Shield size={18} className="text-accent-primary" />
        选择套餐
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const tierIndex = plans.findIndex(p => p.id === plan.id);
          const isUpgrade = tierIndex > currentPlanTier;
          const isDowngrade = tierIndex < currentPlanTier;

          return (
            <div key={plan.id} className={`relative p-4 rounded-lg border transition-all ${
              isCurrent ? 'border-accent-primary bg-accent-primary/5' :
              plan.recommended ? 'border-accent-primary/50 bg-dark-700/80' :
              'border-accent-primary/10 bg-dark-700/50 hover:border-accent-primary/30'
            }`}>
              {plan.recommended && (
                <div className="absolute -top-2 -right-2 bg-accent-primary text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={10} /> 推荐
                </div>
              )}
              <h4 className="font-semibold">{plan.name}</h4>
              <p className="text-2xl font-bold mt-2">
                ¥{plan.price}<span className="text-sm text-gray-400 font-normal">/{plan.billingCycle === 'yearly' ? '年' : '月'}</span>
              </p>
              <div className="mt-3 space-y-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                    {f.included ? <Check size={12} className="text-green-400 shrink-0" /> : <X size={12} className="text-red-400 shrink-0" />}
                    {f.name}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="block text-center text-sm text-accent-primary py-2">当前套餐</span>
                ) : isDowngrade ? (
                  <button onClick={() => alert('不能降级套餐，订阅仅支持升级。')}
                    className="w-full py-2 rounded-lg text-sm bg-dark-600 text-gray-500 cursor-not-allowed">
                    降级至{plan.name} （不支持）
                  </button>
                ) : (
                  <button onClick={() => setConfirmDialog({ type: 'upgrade', planId: plan.id, planName: plan.name })}
                    className="w-full py-2 rounded-lg text-sm bg-accent-primary text-white hover:bg-accent-primary/90 transition-all">
                    升级至{plan.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="p-4 bg-dark-700/50 rounded-lg border border-accent-primary/10">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <History size={16} className="text-accent-primary" />
            支付记录
          </h4>
          <div className="space-y-2">
            {payments.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-dark-800/50 rounded">
                <div>
                  <span className="text-gray-300">¥{p.amount}</span>
                  <span className="text-gray-500 ml-2">{p.paymentMethod || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={p.status === 'success' ? 'text-green-400' : p.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}>
                    {p.status === 'success' ? '已完成' : p.status === 'pending' ? '处理中' : '失败'}
                  </span>
                  <span className="text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="p-6 bg-dark-800 rounded-xl border border-accent-primary/20 max-w-sm mx-4 w-full">
            <h3 className="font-semibold text-lg mb-2">
              {confirmDialog.type === 'cancel' ? '取消订阅' : '升级套餐'}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {confirmDialog.type === 'cancel' 
                ? '取消后，当前订阅周期结束后将不再续费，您将降级到免费版。确定继续？'
                : `确认升级到「${confirmDialog.planName}」？升级后将立即生效。`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-dark-600 text-gray-300 rounded-lg hover:bg-dark-500 text-sm">
                取消
              </button>
              <button onClick={() => {
                if (confirmDialog.type === 'cancel') handleCancel();
                else if (confirmDialog.planId) handleUpgrade(confirmDialog.planId);
              }} disabled={actionLoading}
                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 text-sm disabled:opacity-50">
                {actionLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
