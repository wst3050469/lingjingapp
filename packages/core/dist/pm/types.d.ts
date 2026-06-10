export type WorkItemType = 'task' | 'bug' | 'feature' | 'story' | 'epic';
export type WorkItemStatus = 'todo' | 'in_progress' | 'done' | 'closed';
export type WorkItemPriority = 'low' | 'medium' | 'high' | 'critical';
export type DefectSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'trivial';
export interface WorkItem {
    id: string;
    title: string;
    description?: string;
    type: WorkItemType;
    status: WorkItemStatus;
    priority: WorkItemPriority;
    assignee?: string;
    projectPath: string;
    milestoneId?: string;
    labels: string[];
    defectSeverity?: DefectSeverity;
    defectCategory?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
}
export interface BoardColumn {
    id: string;
    name: string;
    status: WorkItemStatus;
    wipLimit?: number;
    position: number;
    projectPath: string;
}
export interface Milestone {
    id: string;
    name: string;
    description?: string;
    status: 'planned' | 'active' | 'completed';
    dueDate?: string;
    projectPath: string;
    createdAt: string;
    updatedAt: string;
}
export interface StatusChangeLog {
    id: number;
    workItemId: string;
    fromStatus: WorkItemStatus;
    toStatus: WorkItemStatus;
    changedBy?: string;
    changedAt: string;
}
export interface CreateWorkItemInput {
    title: string;
    description?: string;
    type?: WorkItemType;
    priority?: WorkItemPriority;
    assignee?: string;
    milestoneId?: string;
    labels?: string[];
    defectSeverity?: DefectSeverity;
    defectCategory?: string;
}
export interface UpdateWorkItemInput {
    title?: string;
    description?: string;
    type?: WorkItemType;
    priority?: WorkItemPriority;
    assignee?: string;
    milestoneId?: string;
    labels?: string[];
    defectSeverity?: DefectSeverity;
    defectCategory?: string;
    version: number;
}
//# sourceMappingURL=types.d.ts.map