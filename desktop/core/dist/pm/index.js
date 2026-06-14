// Stub: pm (project management) module
export class WorkItemStateMachine {
  transition(workItem, newStatus) { return { ...workItem, status: newStatus }; }
  getValidTransitions() { return []; }
}
export var WorkItem = {};
export var WorkItemStatus = {};
export var BoardColumn = {};
export var Milestone = {};
export var CreateWorkItemInput = {};
export var UpdateWorkItemInput = {};
