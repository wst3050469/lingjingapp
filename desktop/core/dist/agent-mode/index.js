// Stub: agent-mode module
export class AgentModeEnhancer {
  constructor() { this._plan = null; this._step = null; }
  async previewPlan(instruction, steps) { this._plan = { instruction, steps, status: 'preview' }; return this._plan; }
  getPlan() { return this._plan; }
  confirmStep(stepId) { this._step = stepId; return { confirmed: true, stepId }; }
  interrupt() { return { interrupted: true }; }
}
