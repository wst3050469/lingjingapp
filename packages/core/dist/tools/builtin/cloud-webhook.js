// Cloud webhook tool - AI can trigger external integrations via cloud
// Enables CI/CD triggers, GitHub/GitLab hooks, Slack/Discord notifications, etc.
const CLOUD_URL = process.env.LINGJING_CLOUD_URL || 'https://www.spiritrealmz.com';
const API_KEY = process.env.LINGJING_CLOUD_KEY || 'lingjing-cloud-key';
let _enabled = true;
export function initCloudWebhookTool(enabled) {
    if (enabled !== undefined)
        _enabled = enabled;
}
export const cloudWebhookTool = {
    name: 'cloud_webhook',
    description: `Trigger external integrations through the cloud webhook system. Use this to send notifications, trigger CI/CD pipelines, or notify external services. Available channels include custom named hooks. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'string',
                description: 'Webhook channel name, e.g. "github", "slack", "deploy", "ci".',
            },
            payload: {
                type: 'object',
                description: 'JSON payload to send with the webhook. Can contain any data the receiving service expects.',
            },
            action: {
                type: 'string',
                description: '"trigger" to send a webhook, "logs" to view recent webhook deliveries for a channel.',
                enum: ['trigger', 'logs'],
            },
        },
        required: ['channel', 'action'],
    },
    async execute(params, _context) {
        if (!_enabled) {
            return { content: 'Cloud webhook system is disabled.', isError: true };
        }
        const channel = params.channel;
        const action = params.action || 'trigger';
        try {
            switch (action) {
                case 'trigger': {
                    const payload = params.payload || {};
                    const res = await fetch(`${CLOUD_URL}/api/webhook/${encodeURIComponent(channel)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok)
                        throw new Error(`Webhook ${res.status}`);
                    const r = await res.json();
                    return { content: `Webhook triggered on channel "${r.channel}". Status: OK` };
                }
                case 'logs': {
                    const res = await fetch(`${CLOUD_URL}/api/webhook/${encodeURIComponent(channel)}`, {
                        headers: { 'x-api-key': API_KEY },
                    });
                    if (!res.ok)
                        throw new Error(`Webhook ${res.status}`);
                    const logs = await res.json();
                    if (!Array.isArray(logs) || logs.length === 0) {
                        return { content: `No webhook logs for channel "${channel}".` };
                    }
                    const lines = logs.map((l) => `[${l.received_at?.slice(0, 19)}] ${l.id}\n  ${(l.payload || '').slice(0, 200)}`);
                    return { content: `Webhook logs for "${channel}" (${logs.length}):\n\n${lines.join('\n\n')}` };
                }
                default:
                    return { content: `Unknown action: "${action}". Use "trigger" or "logs".`, isError: true };
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: `Cloud webhook operation failed: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=cloud-webhook.js.map