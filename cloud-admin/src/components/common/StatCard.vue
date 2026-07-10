<template>
  <NeonCard class="stat-card">
    <div class="stat-card-body">
      <div class="stat-icon" v-if="resolvedIcon">
        <component :is="resolvedIcon" />
      </div>
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">
          {{ displayValue }}
          <span class="stat-suffix" v-if="suffix">{{ suffix }}</span>
        </div>
        <div class="stat-trend" v-if="trend !== undefined" :class="trend >= 0 ? 'trend-up' : 'trend-down'">
          {{ trend >= 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
        </div>
      </div>
    </div>
  </NeonCard>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import NeonCard from '@/components/neon/NeonCard.vue';
import { formatNumber } from '@/utils/format';

// 常用图标映射
import {
  TeamOutlined, UserOutlined, BuildOutlined, CheckCircleOutlined,
  FileTextOutlined, ShopOutlined, ContactsOutlined, ClockCircleOutlined,
} from '@ant-design/icons-vue';

const iconMap: Record<string, Component> = {
  team: TeamOutlined,
  user: UserOutlined,
  building: BuildOutlined,
  'check-circle': CheckCircleOutlined,
  'file-text': FileTextOutlined,
  shop: ShopOutlined,
  contacts: ContactsOutlined,
  'clock-circle': ClockCircleOutlined,
};

const props = withDefaults(defineProps<{
  title: string;
  value: number;
  icon?: Component | string;
  suffix?: string;
  trend?: number;
}>(), { suffix: '' });

const resolvedIcon = computed(() => {
  if (!props.icon) return undefined;
  if (typeof props.icon === 'string') return iconMap[props.icon];
  return props.icon;
});

const displayValue = computed(() => formatNumber(props.value));
</script>

<style scoped>
.stat-card-body { display: flex; align-items: center; gap: 16px; }
.stat-icon { font-size: 32px; color: var(--neon-cyan); }
.stat-title { color: var(--text-secondary); font-size: 13px; margin-bottom: 4px; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--text-primary); }
.stat-suffix { font-size: 14px; color: var(--text-secondary); margin-left: 4px; }
.stat-trend { font-size: 12px; margin-top: 4px; }
.trend-up { color: var(--neon-green); }
.trend-down { color: var(--neon-orange); }
</style>