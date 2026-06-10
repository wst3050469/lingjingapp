import { ErrorCode, ERROR_CODE_CATEGORY_MAP } from './types.js';
export function inferErrorCode(error) {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (name.includes('timeout') || msg.includes('timeout') || msg.includes('timed out')) {
            return ErrorCode.LLM_TIMEOUT;
        }
        if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('auth')) {
            return ErrorCode.LLM_AUTH_FAILED;
        }
        if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
            return ErrorCode.LLM_RATE_LIMITED;
        }
        if (msg.includes('5xx') || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('internal server error')) {
            return ErrorCode.LLM_SERVER_ERROR;
        }
        if (msg.includes('context') && (msg.includes('too long') || msg.includes('exceed') || msg.includes('overflow'))) {
            return ErrorCode.LLM_CONTEXT_TOO_LONG;
        }
        if (msg.includes('model') && msg.includes('not found')) {
            return ErrorCode.LLM_MODEL_NOT_FOUND;
        }
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('forbidden')) {
            return ErrorCode.SECURITY_PERMISSION_DENIED;
        }
        if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) {
            return ErrorCode.NETWORK_UNREACHABLE;
        }
        if (msg.includes('ssl') || msg.includes('certificate')) {
            return ErrorCode.NETWORK_SSL_ERROR;
        }
        if (msg.includes('cancel') || msg.includes('abort')) {
            return ErrorCode.AGENT_CANCELLED;
        }
        if (msg.includes('sandbox') || msg.includes('violation')) {
            return ErrorCode.TOOL_SANDBOX_VIOLATION;
        }
        if (msg.includes('not found') && msg.includes('tool')) {
            return ErrorCode.TOOL_NOT_FOUND;
        }
        if (msg.includes('mcp') && msg.includes('connect')) {
            return ErrorCode.MCP_CONNECTION_FAILED;
        }
        if (msg.includes('enoent')) {
            return ErrorCode.TOOL_NOT_FOUND;
        }
        if (name.includes('typeerror') || name.includes('rangeerror') || name.includes('syntaxerror')) {
            return ErrorCode.TOOL_PARAMS_INVALID;
        }
    }
    return ErrorCode.UNKNOWN;
}
export function inferErrorCategory(error) {
    const code = inferErrorCode(error);
    return ERROR_CODE_CATEGORY_MAP[code];
}
export function inferSuggestions(error) {
    if (!(error instanceof Error))
        return [];
    const msg = error.message.toLowerCase();
    const suggestions = [];
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
        suggestions.push('请检查API密钥是否正确配置');
        suggestions.push('确认API密钥未过期');
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
        suggestions.push('请稍后重试');
        suggestions.push('检查是否超过API调用配额');
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
        suggestions.push('检查网络连接是否正常');
        suggestions.push('尝试增大超时时间配置');
    }
    if (msg.includes('context') && (msg.includes('too long') || msg.includes('exceed'))) {
        suggestions.push('精简当前对话上下文');
        suggestions.push('开启上下文压缩功能');
    }
    if (msg.includes('tool') && msg.includes('not found')) {
        suggestions.push('检查工具是否已注册');
        suggestions.push('确认工具名称拼写正确');
    }
    if (msg.includes('permission') || msg.includes('denied')) {
        suggestions.push('检查当前角色权限配置');
        suggestions.push('联系管理员授予权限');
    }
    if (msg.includes('network') || msg.includes('econnrefused')) {
        suggestions.push('检查网络连接');
        suggestions.push('确认目标服务是否可达');
    }
    if (msg.includes('sandbox') || msg.includes('violation')) {
        suggestions.push('检查命令是否在白名单中');
        suggestions.push('降低工具风险等级或使用沙箱执行');
    }
    if (suggestions.length === 0) {
        suggestions.push('查看详细错误日志获取更多信息');
        suggestions.push('尝试重新执行操作');
    }
    return suggestions;
}
export function inferRecoverability(error) {
    if (!(error instanceof Error))
        return true;
    const code = inferErrorCode(error);
    const nonRecoverable = [
        ErrorCode.LLM_AUTH_FAILED,
        ErrorCode.LLM_MODEL_NOT_FOUND,
        ErrorCode.TOOL_PERMISSION_DENIED,
        ErrorCode.TOOL_NOT_FOUND,
        ErrorCode.TOOL_PARAMS_INVALID,
        ErrorCode.SECURITY_UNAUTHORIZED,
        ErrorCode.SECURITY_TOKEN_EXPIRED,
        ErrorCode.SECURITY_PERMISSION_DENIED,
        ErrorCode.SYSTEM_CONFIG_ERROR,
        ErrorCode.AGENT_CANCELLED,
    ];
    return !nonRecoverable.includes(code);
}
//# sourceMappingURL=infer.js.map