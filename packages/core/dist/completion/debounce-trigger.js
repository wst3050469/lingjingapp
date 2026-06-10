export class DebounceTrigger {
    timer = null;
    delayMs;
    constructor(delayMs = 300) {
        this.delayMs = delayMs;
    }
    trigger(callback) {
        this.cancel();
        this.timer = setTimeout(() => {
            this.timer = null;
            callback();
        }, this.delayMs);
    }
    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    isPending() {
        return this.timer !== null;
    }
}
//# sourceMappingURL=debounce-trigger.js.map