import { CommandAnalyzer } from './command-analyzer.js';
import { RiskClassifier } from './risk-classifier.js';
export class TerminalSuggester {
    commandAnalyzer;
    riskClassifier;
    constructor() {
        this.commandAnalyzer = new CommandAnalyzer();
        this.riskClassifier = new RiskClassifier();
    }
    analyze(intent, projectRoot) {
        const suggestions = this.commandAnalyzer.analyze(intent, projectRoot);
        return suggestions.map(s => this.riskClassifier.classify(s));
    }
}
//# sourceMappingURL=terminal-suggester.js.map