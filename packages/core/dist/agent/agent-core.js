import { Conversation } from './conversation.js';
import { StructuredError } from '../errors/index.js';
export class AgentCore {
    conversation = new Conversation();
    config;
    runStartedAt = 0;
    constructor(config) {
        this.config = config;
    }
    emit(event) {
        this.config.onEvent?.(event);
    }
    getProvider() {
        return this.config.provider;
    }
    getTools() {
        return this.config.tools;
    }
    getExecutor() {
        return this.config.executor;
    }
    getWorkingDirectory() {
        return this.config.workingDirectory;
    }
    createToolContext(signal, extra) {
        return {
            workingDirectory: this.config.workingDirectory,
            signal,
            askUser: this.config.askUser,
            sshTerminalId: this.config.sshTerminalId,
            enableSandbox: this.config.enableSandbox,
            ...extra,
        };
    }
    startTimer() {
        this.runStartedAt = Date.now();
    }
    getElapsedMs() {
        return this.runStartedAt ? Date.now() - this.runStartedAt : 0;
    }
    isTimedOut() {
        return this.config.maxDuration > 0 && this.getElapsedMs() > this.config.maxDuration;
    }
    getConfig() {
        return this.config;
    }
    wrapError(error, context) {
        return StructuredError.from(error, { context });
    }
}
//# sourceMappingURL=agent-core.js.map