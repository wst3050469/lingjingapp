export class CiIntegration {
  constructor() { this.jobs = []; }
  async triggerJenkinsJob(name) { return { id: 'stub' }; }
  async triggerGitHubWorkflow(repo, workflow) { return { id: 'stub' }; }
  async listWorkflowRuns(repo) { return []; }
  async getWorkflowRun(repo, id) { return null; }
  async getWorkflowJobs(repo, id) { return []; }
  async cancelWorkflowRun(repo, id) { return true; }
  async triggerCiWebhook(payload) { return { ok: true }; }
}
export function createCiIntegration() { return new CiIntegration(); }
