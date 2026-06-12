// Cloud session sync tool - AI can sync conversations to/from cloud
// Enables cross-device session continuity
const CLOUD_URL = process.env.LINGJING_CLOUD_URL || 'https://ide.zhejiangjinmo.com';
const API_KEY = process.env.LINGJING_CLOUD_KEY || 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8';
let _enabled = true;
export function initCloudSessionTool(enabled) {
    if (enabled !== undefined)
        _enabled = enabled;
}
async function cloudFetch(path, method = 'GET', body) {
    const res = await fetch(`${CLOUD_URL}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown');
        throw new Error(`Cloud API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}
export const cloudSessionTool = {
    name: 'cloud_session_sync',
    description: `Sync conversation sessions with the LingJing cloud server for cross-device continuity. Use to list cloud sessions, push current conversation to cloud, or pull a session from cloud. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: '"list" to see all cloud sessions, "push" to upload current conversation, "pull" to download a session, "delete" to remove a session.',
                enum: ['list', 'push', 'pull', 'delete'],
            },
            sessionId: {
                type: 'string',
                description: 'Session ID (required for "pull" and "delete" actions)',
            },
            title: {
                type: 'string',
                description: 'Session title (for "push" action)',
            },
            messages: {
                type: 'array',
                description: 'Conversation messages array (for "push" action)',
            },
        },
        required: ['action'],
    },
    async execute(params, _context) {
        if (!_enabled) {
            return { content: 'Cloud session sync is disabled.', isError: true };
        }
        const action = params.action;
        try {
            switch (action) {
                case 'list': {
                    const sessions = await cloudFetch('/sessions');
                    if (!Array.isArray(sessions) || sessions.length === 0) {
                        return { content: 'No cloud sessions found.' };
                    }
                    const lines = sessions.map((s) => `[${s.id}] ${s.title || '(untitled)'} | ${s.created_at?.slice(0, 16)} | ${(s.messages || []).length} messages`);
                    return { content: `Cloud sessions (${sessions.length}):\n\n${lines.join('\n')}` };
                }
                case 'push': {
                    const messages = params.messages;
                    const title = params.title || params.sessionId || 'session';
                    const sessionId = params.sessionId;
                    const r = await cloudFetch('/sessions', 'POST', {
                        id: sessionId || undefined,
                        title,
                        messages: messages || [],
                        metadata: { source: 'lingjing-agent', pushed_at: new Date().toISOString() },
                    });
                    return { content: `Session pushed to cloud. ID: ${r.id}` };
                }
                case 'pull': {
                    const id = params.sessionId;
                    if (!id)
                        return { content: 'Error: "sessionId" is required for "pull".', isError: true };
                    const session = await cloudFetch(`/sessions/${encodeURIComponent(id)}`);
                    const msgs = session.messages || [];
                    const preview = msgs.slice(0, 5).map((m) => `  [${m.role}]: ${(m.content || '').slice(0, 100)}`).join('\n');
                    return {
                        content: `Pulled cloud session: ${session.title}\nID: ${session.id}\nMessages: ${msgs.length}\n\nPreview:\n${preview}\n${msgs.length > 5 ? `... (${msgs.length - 5} more messages)` : ''}`,
                    };
                }
                case 'delete': {
                    const id = params.sessionId;
                    if (!id)
                        return { content: 'Error: "sessionId" is required for "delete".', isError: true };
                    await cloudFetch(`/sessions/${encodeURIComponent(id)}`, 'DELETE');
                    return { content: `Cloud session "${id}" deleted.` };
                }
                default:
                    return { content: `Unknown action: "${action}". Use "list", "push", "pull", or "delete".`, isError: true };
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: `Cloud session sync failed: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=cloud-session.js.map