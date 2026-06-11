import React, { useState } from 'react';
import { usePlanStore, Plan, PlanStep } from '../../stores/plan-store';
import { PlanStepEditor } from './PlanStepEditor';
import { PlanList } from './PlanList';

function StatusIcon({ status }: { status: PlanStep['status'] }) {
  switch (status) {
    case 'completed':
      return <span className="text-green-500">✓</span>;
    case 'in_progress':
      return <span className="text-blue-500 animate-pulse">⟳</span>;
    case 'blocked':
      return <span className="text-red-500">⚠</span>;
    case 'skipped':
      return <span className="text-gray-500">⊘</span>;
    default:
      return <span className="text-gray-400">○</span>;
  }
}

function PlanProgress({ plan }: { plan: Plan }) {
  const completed = plan.steps.filter((s) => s.status === 'completed').length;
  const total = plan.steps.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Progress</span>
        <span>{completed}/{total} steps ({Math.round(progress)}%)</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className={`flex items-start gap-2 py-2 px-2 rounded ${
      step.status === 'in_progress' ? 'bg-blue-900/20' : ''
    }`}>
      <StatusIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-cp-text">
          Step {index + 1}: {step.title}
        </div>
        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
          {step.description}
        </div>
        {step.result && (
          <div className="text-xs text-green-400 mt-1">
            ✓ {step.result}
          </div>
        )}
        {step.error && (
          <div className="text-xs text-red-400 mt-1">
            ⚠ {step.error}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanningPanel() {
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const updatePlan = usePlanStore((s) => s.updatePlan);
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPlanList, setShowPlanList] = useState(false);

  if (!currentPlan) {
    return null;
  }

  const handleApprove = async () => {
    await window.electronAPI.plan.approve(currentPlan.id);
  };

  const handlePause = async () => {
    await window.electronAPI.plan.pause(currentPlan.id);
  };

  const handleResume = async () => {
    await window.electronAPI.plan.resume(currentPlan.id);
  };

  const handleCancel = async () => {
    await window.electronAPI.plan.cancel(currentPlan.id);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.plan.export(currentPlan.id);
      if (result.success) {
        console.log('Plan exported successfully');
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImport = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const planData = JSON.parse(event.target?.result as string);
            await window.electronAPI.plan.import(planData);
            console.log('Plan imported successfully');
          } catch (err) {
            console.error('Import failed:', err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    try {
      const templates = await window.electronAPI.plan.templates();
      const template = templates.templates?.find((t: any) => t.id === templateId);
      if (template) {
        await window.electronAPI.plan.update(currentPlan.id, {
          title: template.name,
          description: template.description || '',
          goals: template.goals || [],
          steps: template.steps || [],
        });
        setShowTemplates(false);
      }
    } catch (err) {
      console.error('Template selection failed:', err);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-cp-text flex items-center gap-2">
            <span className="text-lg">📋</span>
            {currentPlan.title}
          </h3>
          <span className={`text-xs px-2 py-1 rounded ${
            currentPlan.status === 'completed' ? 'bg-green-900/50 text-green-400' :
            currentPlan.status === 'executing' ? 'bg-blue-900/50 text-blue-400' :
            currentPlan.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {currentPlan.status.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-3">{currentPlan.description}</p>
        <PlanProgress plan={currentPlan} />
      </div>

      {/* Steps */}
      <div className="max-h-64 overflow-y-auto px-4 py-2 space-y-1">
        {currentPlan.steps.map((step, index) => (
          <PlanStepItem key={step.id} step={step} index={index} />
        ))}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-2">
        {currentPlan.status === 'draft' && (
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
          >
            ✓ Approve & Execute
          </button>
        )}
        {currentPlan.status === 'executing' && (
          <button
            onClick={handlePause}
            className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded"
          >
            ⏸ Pause
          </button>
        )}
        {currentPlan.status === 'paused' && (
          <button
            onClick={handleResume}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            ▶ Resume
          </button>
        )}
        {(currentPlan.status === 'draft' || currentPlan.status === 'executing' || currentPlan.status === 'paused') && (
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
          >
            ✕ Cancel
          </button>
        )}
        
        {/* Additional action buttons */}
        <div className="flex-1" />
        <button
          onClick={handleEdit}
          disabled={currentPlan.status === 'executing'}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title="Edit plan"
        >
          ✎ Edit
        </button>
        <button
          onClick={handleImport}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
          title="Import plan"
        >
          📥 Import
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
          title="Export plan"
        >
          📤 Export
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          disabled={currentPlan.status === 'executing'}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title="Use template"
        >
          📋 Templates
        </button>
        <button
          onClick={() => setShowPlanList(true)}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
          title="View all plans"
        >
          📑 All Plans
        </button>
      </div>

      {/* Template selection */}
      {showTemplates && (
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800">
          <h4 className="text-sm font-medium text-cp-text mb-2">Select a Template</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleTemplateSelect('template-feature')}
              className="w-full text-left px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              <div className="font-medium">🆕 New Feature</div>
              <div className="text-gray-400 mt-1">Requirements → Design → Code → Test → Document</div>
            </button>
            <button
              onClick={() => handleTemplateSelect('template-refactor')}
              className="w-full text-left px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              <div className="font-medium">🔄 Refactoring</div>
              <div className="text-gray-400 mt-1">Analyze → Refactor → Test → Verify</div>
            </button>
            <button
              onClick={() => handleTemplateSelect('template-bugfix')}
              className="w-full text-left px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              <div className="font-medium">🐛 Bug Fix</div>
              <div className="text-gray-400 mt-1">Reproduce → Diagnose → Fix → Test</div>
            </button>
          </div>
        </div>
      )}

      {/* Step editor modal */}
      {isEditing && (
        <PlanStepEditor
          planId={currentPlan.id}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Plan list modal */}
      {showPlanList && (
        <PlanList
          onSelectPlan={async (planId) => {
            try {
              const result = await window.electronAPI.plan.load(planId, currentPlan?.workingDirectory || '');
              if (result.success && result.plan) {
                const store = usePlanStore.getState();
                const exists = store.plans.find(p => p.id === result.plan.id);
                if (!exists) {
                  store.setPlans([result.plan, ...store.plans]);
                }
                store.setCurrentPlan(result.plan);
              } else {
                console.error('Load plan failed:', result.error);
              }
            } catch (err) {
              console.error('Load plan failed:', err);
            }
          }}
          onClose={() => setShowPlanList(false)}
        />
      )}
    </div>
  );
}
