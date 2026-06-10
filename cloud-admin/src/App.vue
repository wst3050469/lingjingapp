<template>
  <a-config-provider :theme="neonTheme">
    <router-view v-slot="{ Component, route }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import { neonTheme } from '@/theme/neon-theme';
</script>
