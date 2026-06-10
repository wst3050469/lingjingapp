const VALID_TRANSITIONS = {
    todo: ['in_progress', 'closed'],
    in_progress: ['done', 'todo', 'closed'],
    done: ['closed', 'in_progress'],
    closed: ['todo'],
};
export class WorkItemStateMachine {
    statusChangeLogs = [];
    canTransition(from, to) {
        return VALID_TRANSITIONS[from]?.includes(to) ?? false;
    }
    transition(workItemId, from, to, changedBy, wipCheck) {
        if (!this.canTransition(from, to)) {
            throw new Error(`Invalid status transition: ${from} → ${to}`);
        }
        if (wipCheck && wipCheck.exceeded) {
            throw new Error(`WIP limit exceeded for ${wipCheck.columnStatus}: ${wipCheck.currentCount}/${wipCheck.wipLimit}`);
        }
        const log = {
            id: this.statusChangeLogs.length + 1,
            workItemId,
            fromStatus: from,
            toStatus: to,
            changedBy,
            changedAt: new Date().toISOString(),
        };
        this.statusChangeLogs.push(log);
        return log;
    }
    parseLinkedIds(commitMessage) {
        const matches = commitMessage.match(/#(\w+)/g);
        if (!matches)
            return [];
        return matches.map(m => m.substring(1));
    }
    getChangeLogs(workItemId) {
        if (workItemId) {
            return this.statusChangeLogs.filter(l => l.workItemId === workItemId);
        }
        return [...this.statusChangeLogs];
    }
    getValidTransitions(status) {
        return VALID_TRANSITIONS[status] || [];
    }
}
//# sourceMappingURL=state-machine.js.map