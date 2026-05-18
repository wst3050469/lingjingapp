import React, { useState } from 'react';
import { usePlanStore, Plan, PlanStep } from '../../stores/plan-store';

interface PlanStepEditorProps {
  planId: string;
  onClose: () => void;
}

export function PlanStepEditor({ planId, onClose }: PlanStepEditorProps) {
  const currentPlan = usePlanStore((s) => s.currentPlan);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    goals: string[];
    constraints: string[];
    steps: Array<{
      title: string;
      description: string;
      files: string;
      commands: string;
    }>;
  }>({
    title: currentPlan?.title || '',
    description: currentPlan?.description || '',
    goals: currentPlan?.goals || [''],
    constraints: currentPlan?.constraints || [''],
    steps: currentPlan?.steps.map(s => ({
      title: s.title,
      description: s.description,
      files: (s.files || []).join('\n'),
      commands: (s.commands || []).join('\n'),
    })) || [],
  });

  if (!currentPlan || currentPlan.id !== planId) {
    return null;
  }

  const handleSave = async () => {
    const updatedPlan: Plan = {
      ...currentPlan,
      title: formData.title,
      description: formData.description,
      goals: formData.goals.filter(g => g.trim()),
      constraints: formData.constraints.filter(c => c.trim()),
      steps: formData.steps.map((s, i) => ({
        ...currentPlan.steps[i],
        title: s.title,
        description: s.description,
        files: s.files.split('\n').filter(f => f.trim()),
        commands: s.commands.split('\n').filter(c => c.trim()),
      })),
    };

    await window.electronAPI.plan.update(planId, {
      title: updatedPlan.title,
      description: updatedPlan.description,
      goals: updatedPlan.goals,
      constraints: updatedPlan.constraints,
      steps: updatedPlan.steps,
    });

    setEditing(false);
  };

  const addGoal = () => {
    setFormData(prev => ({ ...prev, goals: [...prev.goals, ''] }));
  };

  const addConstraint = () => {
    setFormData(prev => ({ ...prev, constraints: [...prev.constraints, ''] }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { title: '', description: '', files: '', commands: '' }],
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cp-text">Edit Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="Plan title..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              rows={3}
              placeholder="Brief description..."
            />
          </div>

          {/* Goals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Goals</label>
              <button
                onClick={addGoal}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Goal
              </button>
            </div>
            <div className="space-y-2">
              {formData.goals.map((goal, i) => (
                <input
                  key={i}
                  type="text"
                  value={goal}
                  onChange={(e) => {
                    const newGoals = [...formData.goals];
                    newGoals[i] = e.target.value;
                    setFormData(prev => ({ ...prev, goals: newGoals }));
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder={`Goal ${i + 1}...`}
                />
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Steps ({formData.steps.length})
              </label>
              <button
                onClick={addStep}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Step
              </button>
            </div>
            <div className="space-y-4">
              {formData.steps.map((step, stepIndex) => (
                <div key={stepIndex} className="border border-gray-600 rounded p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-400">Step {stepIndex + 1}</span>
                    <button
                      onClick={() => removeStep(stepIndex)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const newSteps = [...formData.steps];
                      newSteps[stepIndex] = { ...newSteps[stepIndex], title: e.target.value };
                      setFormData(prev => ({ ...prev, steps: newSteps }));
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    placeholder="Step title..."
                  />
                  <textarea
                    value={step.description}
                    onChange={(e) => {
                      const newSteps = [...formData.steps];
                      newSteps[stepIndex] = { ...newSteps[stepIndex], description: e.target.value };
                      setFormData(prev => ({ ...prev, steps: newSteps }));
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    rows={2}
                    placeholder="Step description..."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Files (one per line)</label>
                      <textarea
                        value={step.files}
                        onChange={(e) => {
                          const newSteps = [...formData.steps];
                          newSteps[stepIndex] = { ...newSteps[stepIndex], files: e.target.value };
                          setFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono"
                        rows={3}
                        placeholder="src/file1.ts&#10;src/file2.ts"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commands (one per line)</label>
                      <textarea
                        value={step.commands}
                        onChange={(e) => {
                          const newSteps = [...formData.steps];
                          newSteps[stepIndex] = { ...newSteps[stepIndex], commands: e.target.value };
                          setFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono"
                        rows={3}
                        placeholder="npm install&#10;npm test"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
