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
          :aria-label="group.items[0].label"
          :aria-current="isActive(group.items[0].path) ? 'page' : undefined"
        >
          <template #icon>
            <component :is="group.items[0].icon" />
          </template>
          <span>{{ group.items[0].label }}</span>
        </a-menu-item>

        <!-- 多个子项的组展示为可折叠子菜单 -->
        <a-sub-menu v-else :key="group.key">
          <template #title>
            <span>{{ group.label }}</span>
          </template>
          <template #icon>
            <FolderOutlined />
          </template>
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
  MessageOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  TeamOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  ShopOutlined,
  SolutionOutlined,
  MoneyCollectOutlined,
  ReadOutlined,
  ToolOutlined,
  ApiOutlined,
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
    key: 'business',
    label: '业务管理',
    items: [
      { path: '/contracts', label: '合同管理', icon: SafetyOutlined },
      { path: '/suppliers', label: '供应商管理', icon: ShopOutlined },
      { path: '/customers', label: '客户管理', icon: TeamOutlined },
      { path: '/invoices', label: '发票管理', icon: SolutionOutlined },
      { path: '/finance', label: '财务管理', icon: MoneyCollectOutlined },
    ],
  },
  {
    key: 'content',
    label: '内容管理',
    items: [
      { path: '/samples', label: '样本管理', icon: ReadOutlined },
      { path: '/recipes', label: '配方管理', icon: ToolOutlined },
    ],
  },
  {
    key: 'operations',
    label: '运维管理',
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
      { path: '/audit-logs', label: '审计日志', icon: FileTextOutlined },
    ],
  },
];

// 选中的菜单项
const selectedKeys = computed(() => {
  const exact = navGroups.flatMap(g => g.items).find(i => i.path === route.path);
  if (exact) return [exact.path];
  // 按前缀匹配（支持嵌套路由）
  const prefix = navGroups
    .flatMap(g => g.items)
    .filter(i => i.path !== '/' && route.path.startsWith(i.path))
    .sort((a, b) => b.path.length - a.path.length);
  return prefix.length > 0 ? [prefix[0].path] : [route.path];
});

// 默认展开当前页面所在的组
const defaultOpenKeys = computed(() => {
  const group = navGroups.find(g =>
    g.items.some(i => selectedKeys.value.includes(i.path)),
  );
  return group ? [group.key] : [];
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

/* 单个 a-menu 占满剩余空间 */
.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
  background: transparent !important;
  border-inline-end: none !important;
}

/* 菜单项样式 */
.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: rgba(0, 245, 255, 0.1) !important;
  color: var(--neon-cyan) !important;
}

.sidebar-menu :deep(.ant-menu-item:hover) {
  background: rgba(0, 245, 255, 0.05) !important;
}

.sidebar-menu :deep(.ant-menu-item .anticon) {
  font-size: 18px;
}

/* 子菜单标题样式 */
.sidebar-menu :deep(.ant-menu-submenu-title) {
  margin: 2px 8px;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary, #6b6b80);
}

.sidebar-menu :deep(.ant-menu-submenu-title:hover) {
  color: var(--text-primary) !important;
  background: rgba(255, 255, 255, 0.02) !important;
}

.sidebar-menu :deep(.ant-menu-submenu-selected .ant-menu-submenu-title) {
  color: var(--neon-cyan) !important;
}

/* 子菜单中的菜单项缩进 */
.sidebar-menu :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 32px !important;
}

/* 子菜单箭头 */
.sidebar-menu :deep(.ant-menu-submenu-arrow) {
  color: var(--text-tertiary);
}

/* 收起状态时子菜单箭头隐藏 */
.sidebar-menu :deep(.ant-menu-inline-collapsed .ant-menu-submenu-arrow) {
  display: none;
}

/* 滚动条 */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}
.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.sidebar-menu::-webkit-scrollbar-track {
  background: transparent;
}

/* 底部收起/展开按钮 */
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
</style>
