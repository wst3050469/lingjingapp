import type { WorkItemStatus, StatusChangeLog } from './types.js';
export interface WipLimitCheck {
    columnStatus: WorkItemStatus;
    currentCount: number;
    wipLimit: number;
    exceeded: boolean;
}
export declare class WorkItemStateMachine {
    private statusChangeLogs;
    canTransition(from: WorkItemStatus, to: WorkItemStatus): boolean;
    transition(workItemId: string, from: WorkItemStatus, to: WorkItemStatus, changedBy?: string, wipCheck?: WipLimitCheck): StatusChangeLog;
    parseLinkedIds(commitMessage: string): string[];
    getChangeLogs(workItemId?: string): StatusChangeLog[];
    getValidTransitions(status: WorkItemStatus): WorkItemStatus[];
}
//# sourceMappingURL=state-machine.d.ts.map