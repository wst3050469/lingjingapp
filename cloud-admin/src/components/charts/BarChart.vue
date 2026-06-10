<template>
  <div class="chart-container" ref="chartRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  data: { name: string; value: number }[];
  horizontal?: boolean;
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

const colors = ['#00f5ff', '#bf00ff', '#4d7cff', '#00ff88', '#ff8800'];

function renderChart() {
  if (!chart) return;
  const isH = props.horizontal;
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#161625', borderColor: '#2a2a42', textStyle: { color: '#e0e0e8' } },
    grid: { left: isH ? 100 : 50, right: 20, top: 10, bottom: 30 },
    [isH ? 'yAxis' : 'xAxis']: { type: 'category', data: props.data.map((d) => d.name), axisLine: { lineStyle: { color: '#2a2a42' } }, axisLabel: { color: '#8b949e' } },
    [isH ? 'xAxis' : 'yAxis']: { type: 'value', splitLine: { lineStyle: { color: '#1e1e32' } }, axisLabel: { color: '#8b949e' } },
    series: [{
      type: 'bar',
      data: props.data.map((d) => d.value),
      barWidth: isH ? 12 : 20,
      itemStyle: { color: new echarts.graphic.LinearGradient(isH ? 0 : 0, isH ? 0 : 1, isH ? 1 : 0, isH ? 0 : 0, [
        { offset: 0, color: '#00f5ff' }, { offset: 1, color: '#4d7cff' },
      ]), borderRadius: isH ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    }],
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