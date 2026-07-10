<template>
  <a-config-provider :theme="neonTheme" :locale="locale">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { neonTheme } from '@/theme/neon-theme';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
const locale = zhCN;
</script>
