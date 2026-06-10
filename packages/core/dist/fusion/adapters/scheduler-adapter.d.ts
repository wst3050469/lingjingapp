import { ISchedulerAdapter, SchedulerTask } from './types.js';
export declare class SchedulerAdapter implements ISchedulerAdapter {
    readonly version = "1.0.0";
    private tasks;
    private nextId;
    register(task: SchedulerTask): Promise<string>;
    unregister(id: string): Promise<boolean>;
    trigger(id: string): Promise<void>;
    list(): Promise<SchedulerTask[]>;
}
export declare function createSchedulerAdapter(): SchedulerAdapter;
//# sourceMappingURL=scheduler-adapter.d.ts.map