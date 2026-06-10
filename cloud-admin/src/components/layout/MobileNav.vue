<template>
  <div class="mobile-nav">
    <div v-for="item in navItems" :key="item.key" :class="['nav-item', { active: route.path === item.key }]" @click="router.push(item.key)">
      <component :is="item.icon" />
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { DesktopOutlined, MessageOutlined, SettingOutlined, AppstoreOutlined } from '@ant-design/icons-vue';

const route = useRoute();
const router = useRouter();

const navItems = [
  { key: '/devices', label: '设备', icon: DesktopOutlined },
  { key: '/sessions', label: '会话', icon: MessageOutlined },
  { key: '/config', label: '配置', icon: SettingOutlined },
  { key: '/skills', label: '更多', icon: AppstoreOutlined },
];
</script>

<style scoped>
.mobile-nav { display: flex; justify-content: space-around; align-items: center; height: 56px; background: var(--dark-800); border-top: var(--border-subtle); position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; }
.nav-item { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--text-secondary); cursor: pointer; transition: color 0.2s; }
.nav-item.active { color: var(--neon-cyan); }
</style>
