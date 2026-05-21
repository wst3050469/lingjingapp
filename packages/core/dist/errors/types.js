export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["LLM_AUTH_FAILED"] = "LLM_AUTH_FAILED";
    ErrorCode["LLM_RATE_LIMITED"] = "LLM_RATE_LIMITED";
    ErrorCode["LLM_TIMEOUT"] = "LLM_TIMEOUT";
    ErrorCode["LLM_SERVER_ERROR"] = "LLM_SERVER_ERROR";
    ErrorCode["LLM_CONTEXT_TOO_LONG"] = "LLM_CONTEXT_TOO_LONG";
    ErrorCode["LLM_STREAM_INTERRUPTED"] = "LLM_STREAM_INTERRUPTED";
    ErrorCode["LLM_MODEL_NOT_FOUND"] = "LLM_MODEL_NOT_FOUND";
    ErrorCode["TOOL_NOT_FOUND"] = "TOOL_NOT_FOUND";
    ErrorCode["TOOL_EXECUTION_FAILED"] = "TOOL_EXECUTION_FAILED";
    ErrorCode["TOOL_PERMISSION_DENIED"] = "TOOL_PERMISSION_DENIED";
    ErrorCode["TOOL_TIMEOUT"] = "TOOL_TIMEOUT";
    ErrorCode["TOOL_PARAMS_INVALID"] = "TOOL_PARAMS_INVALID";
    ErrorCode["TOOL_SANDBOX_VIOLATION"] = "TOOL_SANDBOX_VIOLATION";
    ErrorCode["SYSTEM_OUT_OF_MEMORY"] = "SYSTEM_OUT_OF_MEMORY";
    ErrorCode["SYSTEM_DISK_FULL"] = "SYSTEM_DISK_FULL";
    ErrorCode["SYSTEM_PROCESS_CRASH"] = "SYSTEM_PROCESS_CRASH";
    ErrorCode["SYSTEM_CONFIG_ERROR"] = "SYSTEM_CONFIG_ERROR";
    ErrorCode["NETWORK_UNREACHABLE"] = "NETWORK_UNREACHABLE";
    ErrorCode["NETWORK_DNS_FAILED"] = "NETWORK_DNS_FAILED";
    ErrorCode["NETWORK_CONNECTION_REFUSED"] = "NETWORK_CONNECTION_REFUSED";
    ErrorCode["NETWORK_SSL_ERROR"] = "NETWORK_SSL_ERROR";
    ErrorCode["SECURITY_UNAUTHORIZED"] = "SECURITY_UNAUTHORIZED";
    ErrorCode["SECURITY_TOKEN_EXPIRED"] = "SECURITY_TOKEN_EXPIRED";
    ErrorCode["SECURITY_PERMISSION_DENIED"] = "SECURITY_PERMISSION_DENIED";
    ErrorCode["SECURITY_AUDIT_REQUIRED"] = "SECURITY_AUDIT_REQUIRED";
    ErrorCode["MCP_CONNECTION_FAILED"] = "MCP_CONNECTION_FAILED";
    ErrorCode["MCP_PROTOCOL_ERROR"] = "MCP_PROTOCOL_ERROR";
    ErrorCode["MCP_TOOL_NOT_AVAILABLE"] = "MCP_TOOL_NOT_AVAILABLE";
    ErrorCode["AGENT_TIMEOUT"] = "AGENT_TIMEOUT";
    ErrorCode["AGENT_CANCELLED"] = "AGENT_CANCELLED";
    ErrorCode["AGENT_CONTEXT_OVERFLOW"] = "AGENT_CONTEXT_OVERFLOW";
    ErrorCode["UNKNOWN"] = "UNKNOWN";
})(ErrorCode || (ErrorCode = {}));
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["LLM"] = "llm";
    ErrorCategory["TOOL"] = "tool";
    ErrorCategory["SYSTEM"] = "system";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["SECURITY"] = "security";
    ErrorCategory["MCP"] = "mcp";
    ErrorCategory["AGENT"] = "agent";
    ErrorCategory["UNKNOWN"] = "unknown";
})(ErrorCategory || (ErrorCategory = {}));
export const ERROR_CODE_CATEGORY_MAP = {
    [ErrorCode.LLM_AUTH_FAILED]: ErrorCategory.LLM,
    [ErrorCode.LLM_RATE_LIMITED]: ErrorCategory.LLM,
    [ErrorCode.LLM_TIMEOUT]: ErrorCategory.LLM,
    [ErrorCode.LLM_SERVER_ERROR]: ErrorCategory.LLM,
    [ErrorCode.LLM_CONTEXT_TOO_LONG]: ErrorCategory.LLM,
    [ErrorCode.LLM_STREAM_INTERRUPTED]: ErrorCategory.LLM,
    [ErrorCode.LLM_MODEL_NOT_FOUND]: ErrorCategory.LLM,
    [ErrorCode.TOOL_NOT_FOUND]: ErrorCategory.TOOL,
    [ErrorCode.TOOL_EXECUTION_FAILED]: ErrorCategory.TOOL,
    [ErrorCode.TOOL_PERMISSION_DENIED]: ErrorCategory.TOOL,
    [ErrorCode.TOOL_TIMEOUT]: ErrorCategory.TOOL,
    [ErrorCode.TOOL_PARAMS_INVALID]: ErrorCategory.TOOL,
    [ErrorCode.TOOL_SANDBOX_VIOLATION]: ErrorCategory.TOOL,
    [ErrorCode.SYSTEM_OUT_OF_MEMORY]: ErrorCategory.SYSTEM,
    [ErrorCode.SYSTEM_DISK_FULL]: ErrorCategory.SYSTEM,
    [ErrorCode.SYSTEM_PROCESS_CRASH]: ErrorCategory.SYSTEM,
    [ErrorCode.SYSTEM_CONFIG_ERROR]: ErrorCategory.SYSTEM,
    [ErrorCode.NETWORK_UNREACHABLE]: ErrorCategory.NETWORK,
    [ErrorCode.NETWORK_DNS_FAILED]: ErrorCategory.NETWORK,
    [ErrorCode.NETWORK_CONNECTION_REFUSED]: ErrorCategory.NETWORK,
    [ErrorCode.NETWORK_SSL_ERROR]: ErrorCategory.NETWORK,
    [ErrorCode.SECURITY_UNAUTHORIZED]: ErrorCategory.SECURITY,
    [ErrorCode.SECURITY_TOKEN_EXPIRED]: ErrorCategory.SECURITY,
    [ErrorCode.SECURITY_PERMISSION_DENIED]: ErrorCategory.SECURITY,
    [ErrorCode.SECURITY_AUDIT_REQUIRED]: ErrorCategory.SECURITY,
    [ErrorCode.MCP_CONNECTION_FAILED]: ErrorCategory.MCP,
    [ErrorCode.MCP_PROTOCOL_ERROR]: ErrorCategory.MCP,
    [ErrorCode.MCP_TOOL_NOT_AVAILABLE]: ErrorCategory.MCP,
    [ErrorCode.AGENT_TIMEOUT]: ErrorCategory.AGENT,
    [ErrorCode.AGENT_CANCELLED]: ErrorCategory.AGENT,
    [ErrorCode.AGENT_CONTEXT_OVERFLOW]: ErrorCategory.AGENT,
    [ErrorCode.UNKNOWN]: ErrorCategory.UNKNOWN,
};
//# sourceMappingURL=types.js.map