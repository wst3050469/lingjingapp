// Tenant Manager stub - placeholder for cloud-server compatibility
// The full tenant.js module exists in the compiled production bundle
export class TenantManager {
  constructor(db) { this.db = db; }
  listTenants() { return []; }
  getTenant(id) { return null; }
  createTenant(data) { return { id: 'stub', ...data }; }
  updateTenant(id, data) { return null; }
  deleteTenant(id) { return false; }
  checkQuota(tenantId, metric) { return { used: 0, limit: 99999 }; }
  trackUsage(tenantId, metric, value) { return { ok: true }; }
  getUsageStats(tenantId, days) { return { apiCalls: 0, storage: 0 }; }
  calculateBilling(tenantId) { return { amount: 0, currency: 'CNY' }; }
  getSettings(tenantId) { return {}; }
  updateSettings(tenantId, data) { return {}; }
}
