<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <span class="logo-icon">🧠</span>
        </div>
        <h1>灵境AI 管理后台</h1>
        <p class="subtitle">企业数字大脑 · 平台管理系统</p>
      </div>
      <a-form :model="form" @submit.prevent="handleLogin" layout="vertical">
        <a-form-item label="用户名">
          <a-input v-model:value="form.username" placeholder="请输入管理员用户名" size="large" autocomplete="username">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="form.password" placeholder="请输入密码" size="large" autocomplete="current-password">
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="auth.loading" block size="large">
            {{ auth.loading ? '登录中...' : '登 录' }}
          </a-button>
        </a-form-item>
      </a-form>
      <div v-if="error" class="error-msg">
        <WarningOutlined /> {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserOutlined, LockOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const error = ref('');
const form = reactive({ username: '', password: '' });

async function handleLogin() {
  if (!form.username || !form.password) { error.value = '请输入用户名和密码'; return; }
  error.value = '';
  try {
    await auth.login(form.username, form.password);
    // 登录成功后跳转到之前访问的页面，没有则去首页
    const redirect = (router.currentRoute.value.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e: any) {
    error.value = e?.response?.data?.msg || e?.response?.data?.detail || '登录失败，请检查用户名和密码';
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--bg-primary); padding: 24px;
}
.login-card {
  width: 400px; max-width: 100%; padding: 40px; border-radius: 12px;
  background: var(--bg-card); border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.login-header { text-align: center; margin-bottom: 32px; }
.logo-icon { font-size: 48px; }
h1 { color: var(--text-primary); font-size: 24px; margin-top: 12px; margin-bottom: 4px; }
.subtitle { color: var(--text-secondary); font-size: 14px; }
.error-msg { margin-top: 16px; padding: 8px 12px; background: #fff2f0; border: 1px solid #ffccc7; border-radius: 6px; color: #cf1322; }
</style>
