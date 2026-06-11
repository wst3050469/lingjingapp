/**
 * 灵境 CI Integration — Native CI/CD Integration
 *
 * Supports:
 *   - GitHub Actions: trigger workflows, get status, list runs
 *   - Generic webhook-based CI (Jenkins, GitLab CI, etc.)
 *   - Build status notifications via Slack/Webhook
 *   - CI pipeline monitoring dashboard data
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GITHUB_API = 'https://api.github.com';

export class CiIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || '';
    this.jenkinsUrl = options.jenkinsUrl || process.env.JENKINS_URL || '';
    this.jenkinsUser = options.jenkinsUser || process.env.JENKINS_USER || '';
    this.jenkinsToken = options.jenkinsToken || process.env.JENKINS_TOKEN || '';
    this.enabled = !!(this.githubToken || this.jenkinsUrl);
  }

  // ════════════════════════════════════════
  // GitHub Actions
  // ════════════════════════════════════════

  /**
   * Trigger a GitHub Actions workflow dispatch
   */
  async triggerGitHubWorkflow(owner, repo, workflowId, ref = 'main', inputs = {}) {
    if (!this.githubToken) throw new Error('GITHUB_TOKEN not configured');

    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs }),
    });

    if (res.status === 204) {
      this.emit('workflow:triggered', { owner, repo, workflowId, ref, inputs });
      return { ok: true, message: `Workflow ${workflowId} triggered on ${ref}` };
    }

    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }

  /**
   * List recent workflow runs for a repository
   */
  async listWorkflowRuns(owner, repo, options = {}) {
    const { workflowId, branch, status, perPage = 10 } = options;

    let url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;
    if (branch) url += `&branch=${encodeURIComponent(branch)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    let runs = data.workflow_runs || [];

    // Filter by workflowId if specified
    if (workflowId) {
      runs = runs.filter(r => r.workflow_id === parseInt(workflowId) || r.name === workflowId);
    }

    return runs.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      commit: r.head_sha?.slice(0, 7),
      created_at: r.created_at,
      updated_at: r.updated_at,
      url: r.html_url,
    }));
  }

  /**
   * Get a specific workflow run status
   */
  async getWorkflowRun(owner, repo, runId) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

    const r = await res.json();
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      commit: r.head_sha,
      created_at: r.created_at,
      updated_at: r.updated_at,
      url: r.html_url,
      jobs_url: r.jobs_url,
    };
  }

  /**
   * Get jobs for a workflow run
   */
  async getWorkflowJobs(owner, repo, runId) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

    const data = await res.json();
    return (data.jobs || []).map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.started_at,
      completed_at: j.completed_at,
      url: j.html_url,
    }));
  }

  /**
   * Cancel a workflow run
   */
  async cancelWorkflowRun(owner, repo, runId) {
    if (!this.githubToken) throw new Error('GITHUB_TOKEN not configured');

    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (res.status === 202) {
      return { ok: true, message: `Run ${runId} cancelled` };
    }
    throw new Error(`Failed to cancel: HTTP ${res.status}`);
  }

  // ════════════════════════════════════════
  // Jenkins
  // ════════════════════════════════════════

  /**
   * Trigger a Jenkins job build
   */
  async triggerJenkinsJob(jobName, params = {}) {
    if (!this.jenkinsUrl || !this.jenkinsUser || !this.jenkinsToken) {
      throw new Error('Jenkins not configured');
    }

    const auth = Buffer.from(`${this.jenkinsUser}:${this.jenkinsToken}`).toString('base64');
    let url = `${this.jenkinsUrl}/job/${encodeURIComponent(jobName)}/build`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (res.status === 201) {
      this.emit('jenkins:triggered', { jobName, params });
      return { ok: true, message: `Job ${jobName} triggered` };
    }

    throw new Error(`Jenkins error ${res.status}: ${await res.text()}`);
  }

  // ════════════════════════════════════════
  // Generic Webhook CI (GitLab, Bitbucket, etc.)
  // ════════════════════════════════════════

  /**
   * Trigger a generic CI webhook
   */
  async triggerCiWebhook(webhookUrl, payload = {}) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'lingjing-cloud',
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    return { ok: res.ok, status: res.status };
  }

  // ════════════════════════════════════════
  // Notifications
  // ════════════════════════════════════════

  /**
   * Format CI results as a Slack/Discord notification
   */
  formatCiNotification(owner, repo, runs) {
    const fields = runs.slice(0, 5).map(r => {
      const icon = r.conclusion === 'success' ? '✅' :
                   r.conclusion === 'failure' ? '❌' :
                   r.conclusion === 'cancelled' ? '⚪' : '⏳';
      return {
        label: `${icon} ${r.name}`,
        value: `Branch: \`${r.branch}\` | Commit: \`${r.commit}\` | ${new Date(r.updated_at).toLocaleString()}`,
      };
    });

    return {
      title: `🔧 CI Status — ${owner}/${repo}`,
      fields,
      color: runs.every(r => r.conclusion === 'success') ? '#2EB67D' :
             runs.some(r => r.conclusion === 'failure') ? '#E01E5A' : '#4A90D9',
    };
  }
}

export function createCiIntegration(options = {}) {
  return new CiIntegration(options);
}
