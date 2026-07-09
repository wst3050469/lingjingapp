<template>
  <div class="chart-container" ref="chartRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  data: { dates: string[]; series: { name: string; data: number[] }[] };
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

function renderChart() {
  if (!chart) return;
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#161625', borderColor: '#2a2a42', textStyle: { color: '#e0e0e8' } },
    legend: { textStyle: { color: '#8b949e' }, top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: props.data.dates, axisLine: { lineStyle: { color: '#2a2a42' } }, axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e1e32' } }, axisLabel: { color: '#8b949e' } },
    series: props.data.series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      lineStyle: { width: 2 },
      itemStyle: { color: ['#00f5ff', '#bf00ff', '#4d7cff', '#00ff88'][i % 4] },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: ['rgba(0,245,255,0.15)', 'rgba(191,0,255,0.15)', 'rgba(77,124,255,0.15)', 'rgba(0,255,136,0.15)'][i % 4] },
        { offset: 1, color: 'transparent' },
      ]) },
    })),
  });
}

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    renderChart();
    window.addEventListener('resize', () => chart?.resize());
  }
});

onUnmounted(() => { chart?.dispose(); });

watch(() => props.data, renderChart, { deep: true });
</script>

<style scoped>
.chart-container { width: 100%; height: 300px; }
</style>