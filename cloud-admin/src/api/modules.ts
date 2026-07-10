import { get, post, put, del, upload } from './index';
import type {
  AppAdminLoginRequest, AppAdminLoginResponse,
  AppDashboardStats,
  AppTenant, AppTenantMember,
  AppUser, AppInviteCode, AppTeamInviteCode,
  AppContract, AppSupplier, AppCustomer, AppInvoice, AppFinance,
  AppVersion, AppAuditLogEntry, AppChatSession, AppSample, AppRecipe,
  AppWsOnline, AppAutomationTask,
} from '@/types';

// ── 认证 ──
export const authApi = {
  login: (data: AppAdminLoginRequest) => post<AppAdminLoginResponse>('/login', data),
  checkSession: () => get<{ code: number; nickname: string; role: string }>('/check-session', undefined, true),
  changePassword: (data: { old_password: string; new_password: string }) =>
    post<{ code: number; token: string; msg: string }>('/change-password', data),
};

// ── 仪表盘 ──
export const dashboardApi = {
  stats: () => get<{ code: number; data: AppDashboardStats }>('/dashboard'),
};

// ── 用户管理 ──
export const userApi = {
  // 邀请码用户
  listInviteUsers: (params?: Record<string, any>) => get<{ code: number; data: AppInviteCode[] }>('/users/invite-codes', params),
  // 注册用户
  listRegistered: (params?: Record<string, any>) => get<{ code: number; data: AppUser[] }>('/users/registered', params),
  // 切换用户状态
  toggleUser: (userType: string, userId: string) => post<{ code: number; msg: string }>(`/users/${userType}/${userId}/toggle`),
};

// ── 租户管理 ──
export const tenantApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppTenant[] }>('/tenants', params),
  members: (tenantId: string) => get<{ code: number; data: AppTenantMember[] }>(`/tenants/${tenantId}/members`),
  updateMember: (tenantId: string, username: string, data: any) => put<{ code: number; msg: string }>(`/tenants/${tenantId}/members/${username}`, data),
  removeMember: (tenantId: string, username: string) => del<{ code: number; msg: string }>(`/tenants/${tenantId}/members/${username}`),
  dashboard: (tenantId: string) => get<{ code: number; data: any }>(`/tenants/${tenantId}/dashboard`),
  update: (tenantId: string, data: any) => put<{ code: number; msg: string }>(`/tenants/${tenantId}`, data),
  delete: (tenantId: string) => del<{ code: number; msg: string }>(`/tenants/${tenantId}`),
};

// ── 合同管理 ──
export const contractApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppContract[] }>('/contracts', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppContract }>('/contracts', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/contracts/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/contracts/${id}`),
};

// ── 供应商管理 ──
export const supplierApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppSupplier[] }>('/suppliers', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppSupplier }>('/suppliers', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/suppliers/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/suppliers/${id}`),
};

// ── 客户管理 ──
export const customerApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppCustomer[] }>('/customers', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppCustomer }>('/customers', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/customers/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/customers/${id}`),
};

// ── 发票管理 ──
export const invoiceApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppInvoice[] }>('/invoices', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppInvoice }>('/invoices', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/invoices/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/invoices/${id}`),
};

// ── 财务管理 ──
export const financeApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppFinance[]; total?: number }>('/finance', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppFinance }>('/finance', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/finance/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/finance/${id}`),
};

// ── 版本管理 ──
export const versionApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppVersion[] }>('/app-versions', params),
  create: (data: { version_name: string; version_code: number; release_notes: string; is_force_update: boolean; file: File }) => {
    const fd = new FormData();
    fd.append('version_name', data.version_name);
    fd.append('version_code', String(data.version_code));
    fd.append('release_notes', data.release_notes);
    fd.append('is_force_update', data.is_force_update ? 'true' : 'false');
    fd.append('file', data.file);
    return upload<{ code: number; msg: string; size: number }>('/app-versions', fd);
  },
  publish: (id: number) => post<{ code: number; msg: string }>(`/app-versions/${id}/publish`),
  archive: (id: number) => post<{ code: number; msg: string }>(`/app-versions/${id}/archive`),
  approve: (id: number) => post<{ code: number; msg: string }>(`/app-versions/${id}/approve`),
  reject: (id: number, reason: string) => post<{ code: number; msg: string }>(`/app-versions/${id}/reject`, { reason }),
};

// ── 审计日志 ──
export const auditLogApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppAuditLogEntry[]; total?: number }>('/audit-logs', params),
};

// ── 聊天会话 ──
export const chatApi = {
  sessions: (params?: Record<string, any>) => get<{ code: number; data: AppChatSession[]; total?: number }>('/chat/sessions', params),
  sessionDetail: (id: string) => get<{ code: number; data: AppChatSession }>(`/chat/sessions/${id}`),
  tenantSessions: (tenantId: string) => get<{ code: number; data: AppChatSession[] }>(`/tenants/${tenantId}/sessions`),
};

// ── 配方管理 ──
export const recipeApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppRecipe[] }>('/recipes', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppRecipe }>('/recipes', data),
  update: (id: string, data: any) => put<{ code: number; msg: string }>(`/recipes/${id}`, data),
  delete: (id: string) => del<{ code: number; msg: string }>(`/recipes/${id}`),
};

// ── 样本管理 ──
export const sampleApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppSample[] }>('/samples', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppSample }>('/samples', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/samples/${id}`, data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/samples/${id}`),
};

// ── WebSocket 在线监控 ──
export const wsApi = {
  online: () => get<{ code: number; online_count: number; total_devices: number; online_users: string[]; note: string }>('/ws/online'),
  onlineDetail: () => get<{ code: number; online_users: string[]; devices: Record<string, number> }>('/ws/online-detail'),
  testPush: (data: { user_id: string; title?: string; content?: string }) => post<{ code: number; msg: string; user_online: boolean }>('/ws/test-push', data),
};

// ── 自动化任务 ──
export const automationApi = {
  list: (params?: Record<string, any>) => get<{ code: number; data: AppAutomationTask[] }>('/automation/tasks', params),
  create: (data: any) => post<{ code: number; msg: string; data: AppAutomationTask }>('/automation/tasks', data),
  update: (id: number, data: any) => put<{ code: number; msg: string }>(`/automation/tasks/${id}`, data),
  trigger: (id: number) => post<{ code: number; msg: string }>(`/automation/tasks/${id}/trigger`),
  delete: (id: number) => del<{ code: number; msg: string }>(`/automation/tasks/${id}`),
};

// ── 邀请码管理 ──
export const inviteCodeApi = {
  create: (data: any) => post<{ code: number; msg: string }>('/invite-codes', data),
  delete: (id: number) => del<{ code: number; msg: string }>(`/invite-codes/${id}`),
  createTeamCode: (data: any) => post<{ code: number; msg: string }>('/team-invite-codes', data),
  listTeamCodes: () => get<{ code: number; data: AppTeamInviteCode[] }>('/team-invite-codes'),
  revokeTeamCode: (code: string) => del<{ code: number; msg: string }>(`/team-invite-codes/${code}`),
};
