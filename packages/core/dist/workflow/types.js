/** Possible workflow statuses */
export var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["PENDING"] = "pending";
    WorkflowStatus["RUNNING"] = "running";
    WorkflowStatus["PAUSED"] = "paused";
    WorkflowStatus["COMPLETED"] = "completed";
    WorkflowStatus["FAILED"] = "failed";
    WorkflowStatus["CANCELLED"] = "cancelled";
})(WorkflowStatus || (WorkflowStatus = {}));
/** Task execution status */
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["SKIPPED"] = "skipped";
})(TaskStatus || (TaskStatus = {}));
/** Log level */
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (LogLevel = {}));
/** Trigger type */
export var TriggerType;
(function (TriggerType) {
    TriggerType["MANUAL"] = "manual";
    TriggerType["SCHEDULED"] = "scheduled";
    TriggerType["EVENT"] = "event";
    TriggerType["WEBHOOK"] = "webhook";
})(TriggerType || (TriggerType = {}));
/** Trigger status */
export var TriggerStatus;
(function (TriggerStatus) {
    TriggerStatus["ACTIVE"] = "active";
    TriggerStatus["PAUSED"] = "paused";
    TriggerStatus["ERROR"] = "error";
    TriggerStatus["DISABLED"] = "disabled";
})(TriggerStatus || (TriggerStatus = {}));
//# sourceMappingURL=types.js.map