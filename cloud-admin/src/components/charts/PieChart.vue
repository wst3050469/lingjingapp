<template>
  <div class="chart-container" ref="chartRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  data: { name: string; value: number }[];
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

const colors = ['#00f5ff', '#bf00ff', '#4d7cff', '#00ff88', '#ff8800', '#ff00e5'];

function renderChart() {
  if (!chart) return;
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#161625', borderColor: '#2a2a42', textStyle: { color: '#e0e0e8' } },
    legend: { textStyle: { color: '#8b949e' }, bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: props.data,
      label: { color: '#8b949e' },
      itemStyle: { borderColor: '#0f0f1a', borderWidth: 2 },
      color: colors,
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