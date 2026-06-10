<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title neon-text">灵境管理后台</h1>
      <a-form :model="form" @finish="handleLogin" layout="vertical">
        <a-form-item name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="form.username" placeholder="用户名" size="large" />
        </a-form-item>
        <a-form-item name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" placeholder="密码" size="large" @pressEnter="handleLogin" />
        </a-form-item>
        <a-form-item>
          <GlowButton type="primary" html-type="submit" :loading="authStore.loading" block>登录</GlowButton>
        </a-form-item>
      </a-form>
      <a-alert v-if="error" type="error" :message="error" show-icon style="margin-top: 16px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import GlowButton from '@/components/neon/GlowButton.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const error = ref('');
const form = reactive({ username: '', password: '' });

async function handleLogin() {
  error.value = '';
  try {
    await authStore.login(form.username, form.password);
    router.push((route.query.redirect as string) || '/');
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? '登录失败';
  }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--dark-900); }
.login-card { width: 400px; padding: 40px; background: var(--dark-800); border: var(--border-neon); border-radius: 12px; }
.login-title { text-align: center; margin-bottom: 32px; font-size: 24px; }
</style>