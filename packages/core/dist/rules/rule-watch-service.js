import { watch } from 'fs';
export class RuleWatchService {
    watchers = [];
    onChange = null;
    start(paths, onChange) {
        this.stop();
        this.onChange = onChange;
        for (const path of paths) {
            try {
                const watcher = watch(path, { persistent: false }, () => {
                    this.onChange?.();
                });
                this.watchers.push(watcher);
            }
            catch { }
        }
    }
    stop() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
        this.onChange = null;
    }
}
//# sourceMappingURL=rule-watch-service.js.map