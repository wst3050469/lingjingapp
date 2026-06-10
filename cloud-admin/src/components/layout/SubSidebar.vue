<template>
  <aside
    v-if="subWidth > 0"
    class="sub-sidebar"
    :style="{ width: subWidth + 'px' }"
    role="navigation"
    aria-label="子导航"
  >
    <!-- Header -->
    <div class="sub-header">
      <span class="sub-title">{{ currentPageTitle }}</span>
      <a-button
        type="text"
        size="small"
        @click="$emit('toggle')"
        :aria-label="'折叠子侧栏'"
        class="sub-toggle"
      >
        <LeftOutlined />
      </a-button>
    </div>

    <!-- Content: default slot or built-in sub-nav -->
    <div class="sub-body">
      <slot name="default">
        <!-- Default: show quick actions for current page -->
        <div v-if="props.quickActions.length > 0" class="sub-section">
          <div class="sub-section-label">快捷操作</div>
          <a-button
            v-for="action in props.quickActions"
            :key="action.key"
            type="text"
            block
            class="sub-action-btn"
            @click="action.handler"
          >
            <component :is="action.icon" v-if="action.icon" />
            <span>{{ action.label }}</span>
          </a-button>
        </div>

        <!-- Section: sub-navigation links -->
        <div v-if="props.subNavItems.length > 0" class="sub-section">
          <div class="sub-section-label">页面导航</div>
          <a
            v-for="item in props.subNavItems"
            :key="item.key"
            class="sub-nav-link"
            :class="{ active: item.active }"
            :href="item.href"
            @click.prevent="item.onClick?.()"
            :aria-current="item.active ? 'page' : undefined"
          >
            <component :is="item.icon" v-if="item.icon" class="sub-nav-icon" />
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="sub-nav-badge">{{ item.badge }}</span>
          </a>
        </div>

        <!-- Empty state: no sub-content available -->
        <div v-else-if="props.quickActions.length === 0" class="sub-empty">
          <span class="sub-empty-icon">📌</span>
          <span class="sub-empty-text">{{ currentPageTitle }}</span>
          <span class="sub-empty-hint">无子导航项</span>
        </div>
      </slot>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { LeftOutlined } from '@ant-design/icons-vue';
import type { Component } from 'vue';

export interface QuickAction {
  key: string;
  label: string;
  icon?: Component;
  handler: () => void;
}

export interface SubNavItem {
  key: string;
  label: string;
  icon?: Component;
  href: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

const props = withDefaults(
  defineProps<{
    subWidth: number;
    currentPageTitle: string;
    quickActions?: QuickAction[];
    subNavItems?: SubNavItem[];
  }>(),
  {
    quickActions: () => [],
    subNavItems: () => [],
  },
);

defineEmits<{ (e: 'toggle'): void }>();
</script>

<style scoped>
.sub-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  /* left is set dynamically by AppLayout via inline style or computed */
  bottom: 0;
  z-index: 99;
  background: var(--dark-850, #0d0d14);
  border-right: var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease, opacity 0.15s ease;
}

.sub-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: var(--border-subtle);
  flex-shrink: 0;
}

.sub-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub-toggle {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.sub-toggle:hover {
  color: var(--neon-cyan);
}

.sub-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

/* Sections */
.sub-section {
  padding: 0 0 12px;
}

.sub-section-label {
  padding: 12px 16px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary, #6b6b80);
}

/* Action buttons */
.sub-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  height: auto;
  color: var(--text-secondary);
  margin: 2px 8px;
  border-radius: 8px;
  width: calc(100% - 16px) !important;
  justify-content: flex-start !important;
  text-align: left;
}

.sub-action-btn:hover {
  background: rgba(0, 245, 255, 0.05);
  color: var(--neon-cyan);
}

/* Sub navigation links */
.sub-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  margin: 2px 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  position: relative;
}

.sub-nav-link:hover {
  background: rgba(0, 245, 255, 0.05);
  color: var(--text-primary);
}

.sub-nav-link.active {
  background: rgba(0, 245, 255, 0.1);
  color: var(--neon-cyan);
}

.sub-nav-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--neon-cyan);
  border-radius: 0 3px 3px 0;
}

.sub-nav-link:focus-visible {
  outline: 2px solid var(--neon-cyan);
  outline-offset: -2px;
}

.sub-nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.sub-nav-badge {
  margin-left: auto;
  background: rgba(0, 245, 255, 0.15);
  color: var(--neon-cyan);
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 500;
}

/* Empty state */
.sub-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  gap: 8px;
  color: var(--text-tertiary);
}

.sub-empty-icon {
  font-size: 28px;
  opacity: 0.5;
}

.sub-empty-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.sub-empty-hint {
  font-size: 11px;
}

/* Scrollbar */
.sub-body::-webkit-scrollbar {
  width: 4px;
}

.sub-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.sub-body::-webkit-scrollbar-track {
  background: transparent;
}
</style>
