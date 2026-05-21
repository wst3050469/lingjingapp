/**
 * Slack Tool — Slack 集成
 * AI Agent 可通过此工具发送 Slack 消息和通知
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
export const slackTool = {
    name: 'slack',
    description: `Send messages and notifications to Slack channels through the LingJing cloud server. Use to notify team members, post CI/CD results, send alerts, or share AI-generated reports. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action: "send" to post a message, "notify" to send a rich notification with fields',
                enum: ['send', 'notify'],
            },
            channel: {
                type: 'string',
                description: 'Slack channel ID or name (e.g., "#general", "C123456")',
            },
            text: {
                type: 'string',
                description: 'Message text (supports mrkdwn for "send" action)',
            },
            title: {
                type: 'string',
                description: 'Notification title (for "notify" action)',
            },
            fields: {
                type: 'array',
                description: 'Array of {label, value} objects for rich notification (for "notify" action)',
                items: {
                    type: 'object',
                    properties: {
                        label: { type: 'string' },
                        value: { type: 'string' },
                    },
                },
            },
            color: {
                type: 'string',
                description: 'Hex color for the notification sidebar (e.g., "#4A90D9")',
            },
        },
        required: ['action', 'channel'],
    },
    async execute(params) {
        const { action, channel, text, title, fields, color } = params;
        try {
            if (action === 'send') {
                if (!text)
                    return { content: 'Missing required field: text', isError: true };
                const result = await callCloud('/slack/send', 'POST', { channel, text });
                return { content: `Message sent to ${channel}: ${JSON.stringify(result)}` };
            }
            if (action === 'notify') {
                if (!title)
                    return { content: 'Missing required field: title', isError: true };
                const result = await callCloud('/slack/notify', 'POST', {
                    channel,
                    title,
                    fields: fields || [],
                    color: color || '#4A90D9',
                });
                return { content: `Notification sent to ${channel}: ${JSON.stringify(result)}` };
            }
            return { content: `Unknown action: ${action}`, isError: true };
        }
        catch (err) {
            return { content: `Slack operation failed: ${err.message}`, isError: true };
        }
    },
};
//# sourceMappingURL=slack.js.map