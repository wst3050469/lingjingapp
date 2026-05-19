import { IntentDetector } from '@codepilot/core/intent';
import type { IntentState } from '@codepilot/core/intent';

export class IntentDetectionService {
  private detector: IntentDetector;

  constructor() {
    this.detector = new IntentDetector();
  }

  getState(): IntentState {
    return this.detector.getState();
  }

  recordActivity(type: 'keypress' | 'file-switch' | 'debug-start' | 'debug-stop' | 'scroll' | 'selection'): void {
    this.detector.recordActivity(type);
  }

  onChange(listener: (state: IntentState) => void): () => void {
    return this.detector.onChange(listener);
  }
}
