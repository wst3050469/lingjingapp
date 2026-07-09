import axios from 'axios';
import type { ApiResponse, ApiErrorResponse } from '@/types';

const api = axios.create({
  baseURL: '/api/v1/admin',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export async function get<T>(url: string, params?: Record<string, any>): Promise<T> {
  const res = await api.get<T>(url, { params });
  return res.data;
}

export async function post<T>(url: string, data?: any): Promise<T> {
  const res = await api.post<T>(url, data);
  return res.data;
}

export async function put<T>(url: string, data?: any): Promise<T> {
  const res = await api.put<T>(url, data);
  return res.data;
}

export async function del<T>(url: string): Promise<T> {
  const res = await api.delete<T>(url);
  return res.data;
}

export default api;