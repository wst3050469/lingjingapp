export class CancellationController {
    currentController = null;
    create() {
        this.cancel();
        this.currentController = new AbortController();
        return this.currentController.signal;
    }
    cancel() {
        if (this.currentController) {
            this.currentController.abort();
            this.currentController = null;
        }
    }
    isCancelled() {
        return this.currentController?.signal.aborted ?? false;
    }
}
//# sourceMappingURL=cancellation-controller.js.map