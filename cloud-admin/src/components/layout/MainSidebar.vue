<template>
  <a-layout-sider
    :collapsed="effectiveCollapsed"
    collapsible
    :trigger="null"
    :width="180"
    :collapsedWidth="64"
    class="main-sidebar"
    theme="dark"
    role="navigation"
    aria-label="主导航"
  >
    <!-- Logo -->
    <div class="sidebar-logo">
      <span v-if="!effectiveCollapsed" class="logo-text">灵境 Admin</span>
      <span v-else class="logo-icon">灵</span>
    </div>

    <!-- Navigation Groups -->
    <nav class="nav-groups" :class="{ collapsed: effectiveCollapsed }">
      <div v-for="group in navGroups" :key="group.key" class="nav-group">
        <!-- Group Label (hidden when collapsed) -->
        <div
          v-if="!effectiveCollapsed"
          class="nav-group-label"
          role="heading"
          :aria-level="2"
        >
          {{ group.label }}
        </div>
        <a-divider
          v-if="!effectiveCollapsed"
          class="group-divider"
          :style="{ margin: '6px 16px', borderColor: 'var(--border-subtle)' }"
        />

        <!-- Group Items -->
        <a-menu
          mode="inline"
          :selected-keys="selectedKeys"
          theme="dark"
          :inline-collapsed="effectiveCollapsed"
          class="group-menu"
          @click="handleMenuClick"
        >
          <a-menu-item
            v-for="item in group.items"
            :key="item.path"
            :aria-label="item.label"
            :aria-current="isActive(item.path) ? 'page' : undefined"
          >
            <template #icon>
              <component :is="item.icon" />
            </template>
            <span>{{ item.label }}</span>
          </a-menu-item>
        </a-menu>
      </div>
    </nav>

    <!-- Bottom: collapse toggle (desktop only) -->
    <div
      v-if="!isMobile"
      class="sidebar-toggle"
      @click="$emit('toggle')"
      role="button"
      :aria-label="effectiveCollapsed ? '展开侧栏' : '折叠侧栏'"
      :aria-expanded="!effectiveCollapsed"
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
  AppstoreOutlined,
  DesktopOutlined,
  MessageOutlined,
  DatabaseOutlined,
  BellOutlined,
  BugOutlined,
  SettingOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  UserOutlined,
  CrownOutlined,
  PayCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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

defineProps<{
  effectiveCollapsed: boolean;
  isMobile: boolean;
}>();

defineEmits<{ (e: 'toggle'): void }>();

const router = useRouter();
const route = useRoute();

const navGroups: NavGroup[] = [
  {
    key: 'overview',
    label: '总览',
    items: [
      { path: '/', label: '仪表盘', icon: DashboardOutlined },
    ],
  },
  {
    key: 'business',
    label: '业务管理',
    items: [
      { path: '/devices', label: '设备管理', icon: DesktopOutlined },
      { path: '/sessions', label: '会话管理', icon: MessageOutlined },
      { path: '/skills', label: '技能市场', icon: AppstoreOutlined },
      { path: '/memories', label: '记忆管理', icon: DatabaseOutlined },
      { path: '/push', label: '推送通知', icon: BellOutlined },
      { path: '/defects', label: '缺陷管理', icon: BugOutlined },
    ],
  },
  {
    key: 'users',
    label: '用户体系',
    items: [
      { path: '/users', label: '用户管理', icon: UserOutlined },
      { path: '/subscriptions', label: '订阅管理', icon: CrownOutlined },
      { path: '/payments', label: '支付管理', icon: PayCircleOutlined },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    items: [
      { path: '/config', label: '系统配置', icon: SettingOutlined },
      { path: '/logs', label: '审计日志', icon: FileTextOutlined },
      { path: '/versions', label: '版本管理', icon: CloudUploadOutlined },
    ],
  },
];

// Determine selected key: use exact path match first, then parent route
const selectedKeys = computed(() => {
  const exact = navGroups.flatMap(g => g.items).find(i => i.path === route.path);
  if (exact) return [exact.path];
  // Fallback: match by prefix (for nested routes)
  const prefix = navGroups
    .flatMap(g => g.items)
    .filter(i => i.path !== '/' && route.path.startsWith(i.path))
    .sort((a, b) => b.path.length - a.path.length);
  return prefix.length > 0 ? [prefix[0].path] : [route.path];
});

function isActive(path: string): boolean {
  return selectedKeys.value.includes(path);
}

function handleMenuClick({ key }: { key: string }) {
  router.push(key);
}
</script>

<style scoped>
.main-sidebar {
  position: fixed !important;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  background: var(--dark-900) !important;
  border-right: var(--border-subtle);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: var(--border-subtle);
  flex-shrink: 0;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--neon-cyan);
  text-shadow: 0 0 10px rgba(0, 245, 255, 0.4);
  white-space: nowrap;
}

.logo-icon {
  font-size: 22px;
  font-weight: 700;
  color: var(--neon-cyan);
}

.nav-groups {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-group-label {
  padding: 4px 24px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary, #6b6b80);
  white-space: nowrap;
}

.group-divider {
  margin: 4px 16px !important;
}

/* Override ant-design-vue dark menu styles for group consistency */
.group-menu :deep(.ant-menu) {
  background: transparent !important;
  border-inline-end: none !important;
}

.group-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  padding-left: 24px !important;
}

.nav-groups.collapsed .group-menu :deep(.ant-menu-item) {
  padding-left: 0 !important;
  justify-content: center;
}

.group-menu :deep(.ant-menu-item-selected) {
  background: rgba(0, 245, 255, 0.1) !important;
  color: var(--neon-cyan) !important;
}

.group-menu :deep(.ant-menu-item:hover) {
  background: rgba(0, 245, 255, 0.05) !important;
}

.group-menu :deep(.ant-menu-item .anticon) {
  font-size: 18px;
}

/* Collapse toggle at bottom */
.sidebar-toggle {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: var(--border-subtle);
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
  user-select: none;
}

.sidebar-toggle:hover {
  color: var(--neon-cyan);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--neon-cyan);
  outline-offset: -2px;
}

/* Scrollbar styling */
.main-sidebar::-webkit-scrollbar {
  width: 4px;
}

.main-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.main-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

/* Divider override in dark mode */
:deep(.ant-divider) {
  border-color: var(--border-subtle);
}
</style>
