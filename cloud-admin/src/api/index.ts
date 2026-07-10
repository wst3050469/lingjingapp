import axios from 'axios';
import type { ApiResponse, ApiErrorResponse } from '@/types';
import { message } from 'ant-design-vue';

const api = axios.create({
  baseURL: '/api/v1/admin',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('app_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('app_admin_token');
      window.location.href = '/login';
    } else if (err.response?.status === 403) {
      message.error('没有权限执行此操作');
    } else if (err.response?.status === 500) {
      message.error('服务器内部错误，请稍后重试');
    } else if (err.code === 'ECONNABORTED') {
      message.error('请求超时，请检查网络');
    }
    return Promise.reject(err);
  }
);

export async function get<T>(url: string, params?: Record<string, any>): Promise<T> {
  const res = await api.get<T>(url, { params });
  return res.data;
}

export async function post<T>(url: string, data?: any, showSuccess = false): Promise<T> {
  const res = await api.post<T>(url, data);
  if (showSuccess) {
    const msg = (res.data as any)?.msg || '操作成功';
    message.success(msg);
  }
  return res.data;
}

export async function put<T>(url: string, data?: any, showSuccess = false): Promise<T> {
  const res = await api.put<T>(url, data);
  if (showSuccess) {
    const msg = (res.data as any)?.msg || '更新成功';
    message.success(msg);
  }
  return res.data;
}

export async function del<T>(url: string, showSuccess = true): Promise<T> {
  const res = await api.delete<T>(url);
  if (showSuccess) {
    message.success('删除成功');
  }
  return res.data;
}

/** 文件上传 (multipart/form-data)，axios 自动识别 FormData 并设置正确 Content-Type */
export async function upload<T>(url: string, data: FormData): Promise<T> {
  const res = await api.post<T>(url, data);
  return res.data;
}

export default api;
