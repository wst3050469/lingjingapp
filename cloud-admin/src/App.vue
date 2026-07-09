<template>
  <a-config-provider :theme="neonTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { neonTheme } from '@/theme/neon-theme';
</script>
