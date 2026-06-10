export class ExecutionInterrupter {
    aborted = false;
    abortController = null;
    start() {
        this.aborted = false;
        this.abortController = new AbortController();
        return this.abortController.signal;
    }
    interrupt() {
        this.aborted = true;
        this.abortController?.abort();
    }
    isInterrupted() {
        return this.aborted;
    }
}
//# sourceMappingURL=execution-interrupter.js.map