import axios from 'axios';
import { message } from 'ant-design-vue';
import router from '@/router';

const api = axios.create({
  baseURL: '/api/v1/admin',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 自定义配置：静默处理 401（用于 checkSession 等场景）
declare module 'axios' {
  interface AxiosRequestConfig {
    _silent401?: boolean;
  }
}

// 防止重复跳转登录页（多个并发请求都返回 401 时只跳一次）
let _redirecting = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('app_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：统一处理 HTTP 错误和应用层业务错误
api.interceptors.response.use(
  (res) => {
    // 检查业务层错误码（code !== 0 表示业务失败）
    const data = res.data as any;
    if (data && typeof data.code === 'number' && data.code !== 0) {
      const errMsg = data.msg || data.detail || '操作失败';
      // 静默标志也适用于业务错误
      if (!(res.config as any)?._silent401) {
        message.error(errMsg);
      }
      return Promise.reject(new Error(errMsg));
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('app_admin_token');
      const isOnLoginPage = router.currentRoute.value.path === '/login';
      // checkSession 等静默检查和登录页面不弹错误提示
      if (!err.config?._silent401 && !_redirecting && !isOnLoginPage) {
        message.error('登录已过期，请重新登录');
      }
      if (!_redirecting && !isOnLoginPage) {
        _redirecting = true;
        const currentPath = router.currentRoute.value.fullPath;
        router.push({ path: '/login', query: { redirect: currentPath } });
      }
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

export async function get<T>(url: string, params?: Record<string, any>, silent401 = false): Promise<T> {
  const res = await api.get<T>(url, { params, _silent401: silent401 });
  return res.data;
}

export async function post<T>(url: string, data?: any, showSuccess = false, silent401 = false): Promise<T> {
  const res = await api.post<T>(url, data, { _silent401: silent401 });
  if (showSuccess) {
    const msg = (res.data as any)?.msg || '操作成功';
    message.success(msg);
  }
  return res.data;
}

export async function put<T>(url: string, data?: any, showSuccess = false, silent401 = false): Promise<T> {
  const res = await api.put<T>(url, data, { _silent401: silent401 });
  if (showSuccess) {
    const msg = (res.data as any)?.msg || '更新成功';
    message.success(msg);
  }
  return res.data;
}

export async function del<T>(url: string, showSuccess = true, silent401 = false): Promise<T> {
  const res = await api.delete<T>(url, { _silent401: silent401 });
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
