import { useState } from 'react';
import { usePlanStore, Plan } from '../../stores/plan-store';

interface PlanListProps {
  onSelectPlan: (planId: string) => void;
  onClose: () => void;
}

export function PlanList({ onSelectPlan, onClose }: PlanListProps) {
  const plans = usePlanStore((s) => s.plans);
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const removePlan = usePlanStore((s) => s.removePlan);

  const getStatusColor = (status: Plan['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-900/30';
      case 'executing': return 'text-blue-400 bg-blue-900/30';
      case 'paused': return 'text-yellow-400 bg-yellow-900/30';
      case 'draft': return 'text-gray-400 bg-gray-700/50';
      case 'cancelled': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-700/50';
    }
  };

  const getProgress = (plan: Plan) => {
    const completed = plan.steps.filter((s) => s.status === 'completed').length;
    const total = plan.steps.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const handleDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this plan?')) {
      const removePlan = usePlanStore.getState().removePlan;
      const result = await window.electronAPI.plan.delete(planId, '');
      if (result.success) {
        removePlan(planId);
      } else {
        console.error('Delete failed:', result.error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-cp-text">Saved Plans</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto p-4">
          {plans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <div>No saved plans</div>
              <div className="text-sm mt-2">Plans will appear here when created</div>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => {
                    onSelectPlan(plan.id);
                    onClose();
                  }}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    currentPlan?.id === plan.id
                      ? 'bg-blue-900/30 border border-blue-600'
                      : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-cp-text">{plan.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{plan.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(plan.status)}`}>
                      {plan.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{plan.steps.length} steps</span>
                      <span>{getProgress(plan)}% complete</span>
                      <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={(e) => handleDelete(plan.id, e)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${getProgress(plan)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-400">{plans.length} plan(s) total</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
