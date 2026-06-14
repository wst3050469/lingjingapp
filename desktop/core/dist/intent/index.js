// Stub: intent module
export class IntentDetector {
  getState() { return { success: false, error: 'Not implemented' }; }
}
export class IntentState {
  constructor() { this.currentIntent = null; this.confidence = 0; this.previousIntents = []; }
}
