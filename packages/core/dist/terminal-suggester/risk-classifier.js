import { SafetyChecker } from './safety-checker.js';
export class RiskClassifier {
    safetyChecker;
    constructor() {
        this.safetyChecker = new SafetyChecker();
    }
    classify(suggestion) {
        const result = this.safetyChecker.check(suggestion.command);
        return { ...suggestion, riskLevel: result.riskLevel };
    }
}
//# sourceMappingURL=risk-classifier.js.map