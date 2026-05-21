export var DataType;
(function (DataType) {
    DataType["SESSION"] = "session";
    DataType["CONVERSATION"] = "conversation";
    DataType["MESSAGE"] = "message";
    DataType["FILE"] = "file";
    DataType["SETTINGS"] = "settings";
    DataType["WORKSPACE"] = "workspace";
})(DataType || (DataType = {}));
export var SyncStatus;
(function (SyncStatus) {
    SyncStatus["SYNCED"] = "synced";
    SyncStatus["PENDING"] = "pending";
    SyncStatus["SYNCING"] = "syncing";
    SyncStatus["CONFLICT"] = "conflict";
    SyncStatus["ERROR"] = "error";
    SyncStatus["OFFLINE"] = "offline";
})(SyncStatus || (SyncStatus = {}));
export var OperationType;
(function (OperationType) {
    OperationType["CREATE"] = "create";
    OperationType["UPDATE"] = "update";
    OperationType["DELETE"] = "delete";
})(OperationType || (OperationType = {}));
export const DEFAULT_SYNC_CONFIG = {
    enabled: true,
    autoSync: true,
    syncInterval: 300000,
    dataTypes: [
        DataType.SESSION,
        DataType.CONVERSATION,
        DataType.MESSAGE,
        DataType.SETTINGS
    ],
    maxRetries: 3,
    retryDelay: 5000
};
//# sourceMappingURL=sync.types.js.map