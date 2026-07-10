<template>
  <div class="mobile-nav">
    <div
      v-for="item in navItems"
      :key="item.key"
      :class="['nav-item', { active: isActive(item.key) }]"
      @click="router.push(item.key)"
    >
      <component :is="item.icon" />
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import {
  DashboardOutlined,
  UserOutlined,
  MessageOutlined,
  SettingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons-vue';

const route = useRoute();
const router = useRouter();

function isActive(path: string): boolean {
  if (path === '/dashboard') return route.path === '/' || route.path === '/dashboard';
  return route.path.startsWith(path);
}

const navItems = [
  { key: '/dashboard', label: '概览', icon: DashboardOutlined },
  { key: '/users', label: '用户', icon: UserOutlined },
  { key: '/sessions', label: '会话', icon: MessageOutlined },
  { key: '/versions', label: '版本', icon: CloudUploadOutlined },
  { key: '/audit-logs', label: '日志', icon: SettingOutlined },
];
</script>

<style scoped>
.mobile-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 56px;
  background: var(--dark-800);
  border-top: var(--border-subtle);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  padding: 4px 12px;
  border-radius: 8px;
}
.nav-item.active {
  color: var(--neon-cyan);
}
.nav-item:active {
  background: rgba(0, 245, 255, 0.08);
}
</style>
