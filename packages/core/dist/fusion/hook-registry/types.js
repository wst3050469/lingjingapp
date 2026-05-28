"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookPoint = void 0;
var HookPoint;
(function (HookPoint) {
    HookPoint["BEFORE_LLM_CALL"] = "before_llm_call";
    HookPoint["AFTER_LLM_CALL"] = "after_llm_call";
    HookPoint["BEFORE_TOOL_EXECUTE"] = "before_tool_execute";
    HookPoint["AFTER_TOOL_EXECUTE"] = "after_tool_execute";
    HookPoint["BEFORE_SKILL_LOAD"] = "before_skill_load";
    HookPoint["AFTER_SKILL_LOAD"] = "after_skill_load";
    HookPoint["BEFORE_MEMORY_WRITE"] = "before_memory_write";
    HookPoint["AFTER_COMPACTION"] = "after_compaction";
})(HookPoint || (exports.HookPoint = HookPoint = {}));
//# sourceMappingURL=types.js.map