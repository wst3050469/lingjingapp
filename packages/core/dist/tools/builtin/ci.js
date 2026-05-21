/**
 * CI Tool — CI/CD 集成
 * AI Agent 可通过此工具触发构建、查看构建状态、操作 CI 流水线
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
export const ciTool = {
    name: 'ci',
    description: `Interact with CI/CD systems (GitHub Actions, Jenkins) through the LingJing cloud. Trigger workflows, check build status, view run details, cancel runs, and send CI notifications. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action: "trigger" a workflow, "list" runs, "get" run details, "jobs" for run jobs, "cancel" a run, "jenkins" trigger Jenkins job, "webhook" trigger generic CI webhook',
                enum: ['trigger', 'list', 'get', 'jobs', 'cancel', 'jenkins', 'webhook'],
            },
            provider: {
                type: 'string',
                description: 'CI provider: "github" or "jenkins" (default: github)',
                enum: ['github', 'jenkins'],
            },
            owner: {
                type: 'string',
                description: 'GitHub repository owner/org name',
            },
            repo: {
                type: 'string',
                description: 'GitHub repository name',
            },
            workflowId: {
                type: 'string',
                description: 'Workflow ID or filename (e.g., "ci.yml" or "12345678")',
            },
            ref: {
                type: 'string',
                description: 'Git branch or tag to trigger workflow on (default: "main")',
            },
            inputs: {
                type: 'object',
                description: 'Workflow input parameters (key-value pairs)',
            },
            runId: {
                type: 'string',
                description: 'Workflow run ID (for get, jobs, cancel actions)',
            },
            branch: {
                type: 'string',
                description: 'Filter by branch name (for list action)',
            },
            status: {
                type: 'string',
                description: 'Filter by status: "queued", "in_progress", "completed"',
            },
            jobName: {
                type: 'string',
                description: 'Jenkins job name (for jenkins action)',
            },
            url: {
                type: 'string',
                description: 'Generic webhook URL (for webhook action)',
            },
            payload: {
                type: 'object',
                description: 'Payload to send with the action',
            },
        },
        required: ['action'],
    },
    async execute(params) {
        const { action, provider } = params;
        try {
            switch (action) {
                case 'trigger': {
                    const { owner, repo, workflowId, ref, inputs } = params;
                    if (!owner || !repo || !workflowId) {
                        return { content: 'Missing required: owner, repo, workflowId', isError: true };
                    }
                    const result = await callCloud('/ci/github/trigger', 'POST', {
                        owner, repo, workflowId,
                        ref: ref || 'main',
                        inputs: inputs || {},
                    });
                    return { content: `Workflow triggered:\n${JSON.stringify(result, null, 2)}` };
                }
                case 'list': {
                    const { owner, repo, branch, status, workflow_id } = params;
                    if (!owner || !repo)
                        return { content: 'Missing required: owner, repo', isError: true };
                    const query = new URLSearchParams({ owner, repo });
                    if (branch)
                        query.set('branch', branch);
                    if (status)
                        query.set('status', status);
                    if (workflow_id)
                        query.set('workflow_id', workflow_id);
                    const runs = await callCloud(`/ci/github/runs?${query}`);
                    return { content: `Workflow runs:\n${JSON.stringify(runs, null, 2)}` };
                }
                case 'get': {
                    const { owner, repo, runId } = params;
                    if (!owner || !repo || !runId)
                        return { content: 'Missing required: owner, repo, runId', isError: true };
                    const run = await callCloud(`/ci/github/runs/${owner}/${repo}/${runId}`);
                    return { content: `Run details:\n${JSON.stringify(run, null, 2)}` };
                }
                case 'jobs': {
                    const { owner, repo, runId } = params;
                    if (!owner || !repo || !runId)
                        return { content: 'Missing required: owner, repo, runId', isError: true };
                    const jobs = await callCloud(`/ci/github/runs/${owner}/${repo}/${runId}/jobs`);
                    return { content: `Jobs:\n${JSON.stringify(jobs, null, 2)}` };
                }
                case 'cancel': {
                    const { owner, repo, runId } = params;
                    if (!owner || !repo || !runId)
                        return { content: 'Missing required: owner, repo, runId', isError: true };
                    const result = await callCloud('/ci/github/cancel', 'POST', { owner, repo, runId });
                    return { content: `Cancelled: ${JSON.stringify(result)}` };
                }
                case 'jenkins': {
                    const { jobName } = params;
                    if (!jobName)
                        return { content: 'Missing required: jobName', isError: true };
                    const result = await callCloud('/ci/jenkins/trigger', 'POST', { jobName, params: params.payload || {} });
                    return { content: `Jenkins triggered: ${JSON.stringify(result)}` };
                }
                case 'webhook': {
                    const { url } = params;
                    if (!url)
                        return { content: 'Missing required: url', isError: true };
                    const result = await callCloud('/ci/webhook', 'POST', { url, payload: params.payload || {} });
                    return { content: `Webhook result: ${JSON.stringify(result)}` };
                }
                default:
                    return { content: `Unknown action: ${action}`, isError: true };
            }
        }
        catch (err) {
            return { content: `CI operation failed: ${err.message}`, isError: true };
        }
    },
};
//# sourceMappingURL=ci.js.map