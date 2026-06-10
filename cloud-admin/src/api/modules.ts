import { get, post, put, del } from './index';
import type { Device, Session, Skill, Memory, PushNotification, Defect, Schedule, ApiKey, Version, AuditLogEntry, AuditLogRecord, Payment, Subscription, Invoice, LoginResponse } from '@/types';

export const authApi = {
  login: (data: { username: string; password: string }) => post<LoginResponse>('/login', data),
  checkDefaultPassword: () => get<{ hasDefault: boolean }>('/check-default-password'),
  changePassword: (data: { oldPassword: string; newPassword: string }) => post('/change-password', data),
};

export const deviceApi = {
  list: (params?: Record<string, any>) => get<Device[]>('/devices', params),
  update: (id: string, data: Partial<Device>) => put(`/devices/${id}`, data),
  delete: (id: string) => del(`/devices/${id}`),
};

export const sessionApi = {
  list: (params?: Record<string, any>) => get<Session[]>('/sessions', params),
  delete: (id: string) => del(`/sessions/${id}`),
};

export const skillApi = {
  list: (params?: Record<string, any>) => get<Skill[]>('/skills', params),
  approve: (id: string) => put(`/skills/${id}/approve`),
  reject: (id: string) => put(`/skills/${id}/reject`),
};

export const memoryApi = {
  list: (params?: Record<string, any>) => get<Memory[]>('/memories', params),
  delete: (id: string) => del(`/memories/${id}`),
};

export const pushApi = {
  list: (params?: Record<string, any>) => get<PushNotification[]>('/push', params),
  send: (data: any) => post('/push/send', data),
};

export const defectApi = {
  list: (params?: Record<string, any>) => get<Defect[]>('/defects', params),
  fix: (id: string) => put(`/defects/${id}/fix`),
  verify: (id: string) => put(`/defects/${id}/verify`),
};

export const scheduleApi = {
  list: () => get<Schedule[]>('/schedules'),
  create: (data: any) => post('/schedules', data),
  update: (id: string, data: any) => put(`/schedules/${id}`, data),
  delete: (id: string) => del(`/schedules/${id}`),
};

export const apiKeyApi = {
  list: () => get<ApiKey[]>('/api-keys'),
  create: (data: any) => post('/api-keys', data),
  delete: (id: string) => del(`/api-keys/${id}`),
};

export const versionApi = {
  list: (params?: Record<string, any>) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
    const qs = query.toString();
    return get<any>(`/versions${qs ? '?' + qs : ''}`);
  },
  get: (version: string) => get<Version>(`/versions/${version}`),
  create: (data: any) => post('/versions', data),
  update: (id: string, data: any) => put(`/versions/${id}`, data),
  submit: (version: string) => post(`/versions/${version}/submit`),
  approve: (version: string, comment?: string) => post(`/versions/${version}/approve`, { comment }),
  reject: (version: string, reason: string) => post(`/versions/${version}/reject`, { reason }),
  publish: (version: string) => post(`/versions/${version}/publish`),
};

export const logApi = {
  list: (params?: Record<string, any>) => get<AuditLogEntry[]>('/logs', params),
  stream: () => new EventSource('/logs/stream'),
};

export const paymentApi = {
  list: () => get<Payment[]>('/payments'),
  verify: (id: string) => put(`/payments/${id}/verify`),
};

export const subscriptionApi = {
  list: () => get<Subscription[]>('/plans'),
};

export const invoiceApi = {
  list: () => get<Invoice[]>('/invoices'),
  update: (id: string, data: any) => put(`/invoices/${id}`, data),
};

export const auditLogApi = {
  list: (params?: Record<string, any>) => get<{ data: AuditLogRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>('/audit-logs', params),
};