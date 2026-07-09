<template>
  <div class="search-filter">
    <a-input-search
      v-if="showSearch"
      v-model:value="keyword"
      placeholder="搜索关键词..."
      allow-clear
      @search="handleSearch"
      class="search-input"
    />
    <slot name="filters" />
    <a-button type="primary" @click="handleSearch" v-if="showSearch">搜索</a-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{ showSearch?: boolean }>(), { showSearch: true });

const emit = defineEmits<{ (e: 'search', keyword: string): void }>();
const keyword = ref('');

function handleSearch() {
  emit('search', keyword.value);
}
</script>

<style scoped>
.search-filter { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { max-width: 320px; }
</style>