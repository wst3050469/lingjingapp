export var ConflictType;
(function (ConflictType) {
    ConflictType["UPDATE_UPDATE"] = "update_update";
    ConflictType["UPDATE_DELETE"] = "update_delete";
    ConflictType["DELETE_UPDATE"] = "delete_update";
    ConflictType["DUPLICATE_CREATE"] = "duplicate_create";
    ConflictType["VERSION_MISMATCH"] = "version_mismatch";
})(ConflictType || (ConflictType = {}));
export var ResolutionStrategy;
(function (ResolutionStrategy) {
    ResolutionStrategy["AUTO_MERGE"] = "auto_merge";
    ResolutionStrategy["LOCAL_WIN"] = "local_win";
    ResolutionStrategy["REMOTE_WIN"] = "remote_win";
    ResolutionStrategy["MANUAL"] = "manual";
    ResolutionStrategy["TIMESTAMP"] = "timestamp";
})(ResolutionStrategy || (ResolutionStrategy = {}));
//# sourceMappingURL=conflict.types.js.map