<template>
  <a-layout-sider
    :collapsed="effectiveCollapsed"
    collapsible
    :trigger="null"
    :width="210"
    :collapsedWidth="64"
    class="main-sidebar"
    theme="dark"
    role="navigation"
    aria-label="主导航"
  >
    <!-- Logo -->
    <div class="sidebar-logo">
      <span v-if="!effectiveCollapsed" class="logo-text">灵境 AI</span>
      <span v-else class="logo-icon">灵</span>
    </div>

    <!-- 导航菜单 -->
    <a-menu
      mode="inline"
      :selected-keys="selectedKeys"
      :default-open-keys="defaultOpenKeys"
      theme="dark"
      :inline-collapsed="effectiveCollapsed"
      class="sidebar-menu"
      @click="handleMenuClick"
    >
      <template v-for="group in navGroups" :key="group.key">
        <!-- 只有单个子项的组直接展示菜单项 -->
        <a-menu-item
          v-if="group.items.length === 1"
          :key="group.items[0].path"
        >
          <template #icon><component :is="group.items[0].icon" /></template>
          <span>{{ group.items[0].label }}</span>
        </a-menu-item>

        <!-- 多个子项的组展示为可折叠子菜单 -->
        <a-sub-menu v-else :key="group.key">
          <template #icon><FolderOutlined /></template>
          <template #title>{{ group.label }}</template>
          <a-menu-item
            v-for="item in group.items"
            :key="item.path"
          >
            <template #icon><component :is="item.icon" /></template>
            <span>{{ item.label }}</span>
          </a-menu-item>
        </a-sub-menu>
      </template>
    </a-menu>

    <!-- 底部收起/展开按钮 -->
    <div
      v-if="!isMobile"
      class="sidebar-toggle"
      @click="$emit('toggle')"
      role="button"
      :aria-label="effectiveCollapsed ? '展开侧栏' : '折叠侧栏'"
      tabindex="0"
      @keydown.enter="$emit('toggle')"
      @keydown.space.prevent="$emit('toggle')"
    >
      <MenuFoldOutlined v-if="!effectiveCollapsed" />
      <MenuUnfoldOutlined v-else />
    </div>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  CloudUploadOutlined,
  SafetyOutlined,
  MessageOutlined,
  ApiOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

interface NavItem {
  path: string;
  label: string;
  icon: Component;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

defineProps<{ effectiveCollapsed: boolean; isMobile: boolean }>();
defineEmits<{ (e: 'toggle'): void }>();

const router = useRouter();
const route = useRoute();

const navGroups: NavGroup[] = [
  {
    key: 'overview',
    label: '概览',
    items: [
      { path: '/dashboard', label: '仪表盘', icon: DashboardOutlined },
    ],
  },
  {
    key: 'users',
    label: '用户体系',
    items: [
      { path: '/users', label: '用户管理', icon: UserOutlined },
      { path: '/tenants', label: '租户管理', icon: TeamOutlined },
    ],
  },
  {
    key: 'platform',
    label: '平台管理',
    items: [
      { path: '/versions', label: '版本管理', icon: CloudUploadOutlined },
      { path: '/websocket', label: '在线监控', icon: ApiOutlined },
      { path: '/sessions', label: '会话管理', icon: MessageOutlined },
      { path: '/automation', label: '自动化任务', icon: ApiOutlined },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    items: [
      { path: '/audit-logs', label: '审计日志', icon: SafetyOutlined },
    ],
  },
];

const selectedKeys = computed(() => {
  const exact = navGroups.flatMap(g => g.items).find(i => i.path === route.path);
  if (exact) return [exact.path];
  const prefix = navGroups
    .flatMap(g => g.items)
    .filter(i => i.path !== '/' && route.path.startsWith(i.path))
    .sort((a, b) => b.path.length - a.path.length);
  return prefix.length > 0 ? [prefix[0].path] : [route.path];
});

const defaultOpenKeys = computed(() => {
  const group = navGroups.find(g =>
    g.items.some(i => selectedKeys.value.includes(i.path)),
  );
  return group ? [group.key] : [];
});

function handleMenuClick({ key }: { key: string }) {
  router.push(key);
}
</script>

<style scoped>
.main-sidebar {
  position: fixed !important;
  left: 0; top: 0; bottom: 0;
  z-index: 100;
  background: var(--dark-900) !important;
  border-right: var(--border-subtle);
  display: flex; flex-direction: column;
  transition: width 0.2s ease;
}
.sidebar-logo {
  height: 64px;
  display: flex; align-items: center; justify-content: center;
  border-bottom: var(--border-subtle);
  flex-shrink: 0;
}
.logo-text {
  font-size: 18px; font-weight: 700;
  color: var(--neon-cyan);
  text-shadow: 0 0 10px rgba(0, 245, 255, 0.4);
  white-space: nowrap;
}
.logo-icon {
  font-size: 22px; font-weight: 700;
  color: var(--neon-cyan);
}
.sidebar-menu {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 4px 0; background: transparent !important;
  border-inline-end: none !important;
}
.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 8px; border-radius: 8px;
  height: 40px; line-height: 40px;
}
.sidebar-menu :deep(.ant-menu-item-selected) {
  background: rgba(0, 245, 255, 0.1) !important;
  color: var(--neon-cyan) !important;
}
.sidebar-menu :deep(.ant-menu-item:hover) {
  background: rgba(0, 245, 255, 0.05) !important;
}
.sidebar-menu :deep(.ant-menu-submenu-title) {
  margin: 2px 8px; border-radius: 8px;
  height: 40px; line-height: 40px;
  font-size: 13px; font-weight: 600;
  color: var(--text-tertiary);
}
.sidebar-menu :deep(.ant-menu-submenu-title:hover) {
  color: var(--text-primary) !important;
  background: rgba(255, 255, 255, 0.02) !important;
}
.sidebar-menu :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 32px !important;
}
.sidebar-toggle {
  height: 48px;
  display: flex; align-items: center; justify-content: center;
  border-top: var(--border-subtle);
  cursor: pointer; color: var(--text-secondary);
  flex-shrink: 0; transition: color 0.2s; user-select: none;
}
.sidebar-toggle:hover { color: var(--neon-cyan); }
.sidebar-toggle:focus-visible { outline: 2px solid var(--neon-cyan); outline-offset: -2px; }
.sidebar-menu::-webkit-scrollbar { width: 4px; }
.sidebar-menu::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
.sidebar-menu::-webkit-scrollbar-track { background: transparent; }
</style>
