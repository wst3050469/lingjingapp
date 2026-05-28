"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerStatus = exports.TriggerType = exports.LogLevel = exports.TaskStatus = exports.WorkflowStatus = void 0;
/** Possible workflow statuses */
var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["PENDING"] = "pending";
    WorkflowStatus["RUNNING"] = "running";
    WorkflowStatus["PAUSED"] = "paused";
    WorkflowStatus["COMPLETED"] = "completed";
    WorkflowStatus["FAILED"] = "failed";
    WorkflowStatus["CANCELLED"] = "cancelled";
    WorkflowStatus["PARTIAL"] = "partial";
})(WorkflowStatus || (exports.WorkflowStatus = WorkflowStatus = {}));
/** Task execution status */
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["SKIPPED"] = "skipped";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
/** Log level */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/** Trigger type */
var TriggerType;
(function (TriggerType) {
    TriggerType["MANUAL"] = "manual";
    TriggerType["SCHEDULED"] = "scheduled";
    TriggerType["EVENT"] = "event";
    TriggerType["WEBHOOK"] = "webhook";
})(TriggerType || (exports.TriggerType = TriggerType = {}));
/** Trigger status */
var TriggerStatus;
(function (TriggerStatus) {
    TriggerStatus["ACTIVE"] = "active";
    TriggerStatus["PAUSED"] = "paused";
    TriggerStatus["ERROR"] = "error";
    TriggerStatus["DISABLED"] = "disabled";
})(TriggerStatus || (exports.TriggerStatus = TriggerStatus = {}));
//# sourceMappingURL=types.js.map