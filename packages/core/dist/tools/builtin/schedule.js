/**
 * Schedule Tool — 定时任务管理
 * 让 AI Agent 可以通过云端 API 创建/管理/触发定时任务
 */
const CLOUD_URL = process.env.LINGJING_CLOUD_URL || 'https://ide.zhejiangjinmo.com';
const API_KEY = process.env.LINGJING_API_KEY || 'lingjing-cloud-key';
async function callCloud(path, method = 'GET', body) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
        },
    };
    if (body)
        opts.body = JSON.stringify(body);
    const res = await fetch(`${CLOUD_URL}/api${path}`, opts);
    return res.json();
}
export const scheduleTool = {
    name: 'schedule',
    description: `Manage scheduled tasks (cron jobs) on the LingJing cloud server. Use to create periodic tasks like: daily code review, weekly reports, monitoring checks, CI/CD triggers, etc. Supports cron expressions. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action: "list" all schedules, "create" a new schedule, "update" an existing one, "delete" one, "trigger" immediately, or "logs" to view execution history',
                enum: ['list', 'create', 'update', 'delete', 'trigger', 'logs'],
            },
            id: {
                type: 'string',
                description: 'Schedule ID (required for update, delete, trigger, logs)',
            },
            name: {
                type: 'string',
                description: 'Human-readable name for the schedule (required for create)',
            },
            cronExpr: {
                type: 'string',
                description: 'Standard 5-field cron expression: "minute hour day-of-month month day-of-week". Examples: "0 9 * * 1" = every Monday 9:00, "*/30 * * * *" = every 30 minutes, "0 0 1 * *" = midnight on 1st of each month',
            },
            actionType: {
                type: 'string',
                description: 'Type of action to execute: "http" to call a URL, "shell" to run a command, "webhook" to send internal webhook',
                enum: ['http', 'shell', 'webhook'],
            },
            actionConfig: {
                type: 'object',
                description: 'Action configuration. For http: {url, method?, headers?, body?}. For shell: {command, timeout?}. For webhook: {channel, payload}',
            },
            status: {
                type: 'string',
                description: 'Set schedule status: "active" or "paused"',
                enum: ['active', 'paused'],
            },
            maxRetries: {
                type: 'number',
                description: 'Maximum retry count on failure (default: 3)',
            },
        },
        required: ['action'],
    },
    async execute(params) {
        const { action } = params;
        try {
            switch (action) {
                case 'list': {
                    const data = await callCloud('/schedules');
                    return { content: JSON.stringify(data, null, 2) };
                }
                case 'create': {
                    const { name, cronExpr, actionType, actionConfig, maxRetries } = params;
                    if (!name || !cronExpr) {
                        return { content: 'Missing required fields: name and cronExpr', isError: true };
                    }
                    const created = await callCloud('/schedules', 'POST', {
                        name,
                        cronExpr,
                        actionType: actionType || 'http',
                        actionConfig: actionConfig || {},
                        maxRetries: maxRetries || 3,
                    });
                    return { content: `Schedule created:\n${JSON.stringify(created, null, 2)}` };
                }
                case 'update': {
                    const { id } = params;
                    if (!id)
                        return { content: 'Missing required field: id', isError: true };
                    const updates = {};
                    for (const k of ['name', 'cronExpr', 'actionType', 'actionConfig', 'status', 'maxRetries']) {
                        if (params[k] !== undefined)
                            updates[k] = params[k];
                    }
                    const updated = await callCloud(`/schedules/${id}`, 'PUT', updates);
                    if (updated.error)
                        return { content: `Update failed: ${updated.error}`, isError: true };
                    return { content: `Schedule updated:\n${JSON.stringify(updated, null, 2)}` };
                }
                case 'delete': {
                    const { id } = params;
                    if (!id)
                        return { content: 'Missing required field: id', isError: true };
                    await callCloud(`/schedules/${id}`, 'DELETE');
                    return { content: `Schedule ${id} deleted successfully` };
                }
                case 'trigger': {
                    const { id } = params;
                    if (!id)
                        return { content: 'Missing required field: id', isError: true };
                    const result = await callCloud(`/schedules/${id}/trigger`, 'POST');
                    return { content: `Trigger result:\n${JSON.stringify(result, null, 2)}` };
                }
                case 'logs': {
                    const { id } = params;
                    if (!id)
                        return { content: 'Missing required field: id', isError: true };
                    const logs = await callCloud(`/schedules/${id}/logs`);
                    return { content: `Execution logs:\n${JSON.stringify(logs, null, 2)}` };
                }
                default:
                    return { content: `Unknown action: ${action}`, isError: true };
            }
        }
        catch (err) {
            return { content: `Schedule operation failed: ${err.message}`, isError: true };
        }
    },
};
//# sourceMappingURL=schedule.js.map