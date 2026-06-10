<template>
  <NeonCard
    class="stat-card"
    :class="{ 'stat-card-clickable': clickable }"
    :hoverable="clickable"
  >
    <a-skeleton v-if="loading" active :paragraph="{ rows: 2 }" :title="{ width: '60%' }" />
    <div v-else class="stat-card-body">
      <div class="stat-icon" v-if="icon">
        <component :is="icon" />
      </div>
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">
          <span v-if="isNaN(value)" class="stat-string">{{ value }}</span>
          <template v-else>
            {{ displayValue }}
            <span class="stat-suffix" v-if="suffix">{{ suffix }}</span>
          </template>
        </div>
        <div class="stat-trend" v-if="trend !== undefined && trend !== null" :class="trend >= 0 ? 'trend-up' : 'trend-down'">
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

const props = withDefaults(defineProps<{
  title: string;
  value: number | string;
  icon?: Component;
  suffix?: string;
  trend?: number;
  clickable?: boolean;
  loading?: boolean;
}>(), { suffix: '', clickable: false, loading: false });

const displayValue = computed(() => {
  if (typeof props.value === 'string') return props.value;
  return formatNumber(props.value);
});

const isNaN = (v: any) => typeof v === 'string';
</script>

<style scoped>
.stat-card {
  transition: all 0.25s ease;
}

.stat-card-clickable {
  cursor: pointer;
}

.stat-card-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 245, 255, 0.12), 0 0 40px rgba(77, 124, 255, 0.06);
}

.stat-card-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 32px;
  color: var(--neon-cyan);
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-title {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-string {
  font-size: 20px;
  color: var(--neon-cyan);
}

.stat-suffix {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.stat-trend {
  font-size: 12px;
  margin-top: 4px;
}

.trend-up { color: var(--neon-green); }
.trend-down { color: var(--neon-orange); }
</style>
