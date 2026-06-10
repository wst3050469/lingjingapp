<script setup lang="ts">
import { createI18n, useI18n } from './i18n'
import ParticleBackground from './effects/ParticleBackground.vue'
import MouseGlow from './effects/MouseGlow.vue'
import HeroSection from './components/HeroSection.vue'
import FeaturesSection from './components/FeaturesSection.vue'
import TechArchSection from './components/TechArchSection.vue'
import StepsSection from './components/StepsSection.vue'
import TestimonialsSection from './components/TestimonialsSection.vue'
import FooterSection from './components/FooterSection.vue'

// Init i18n (read saved locale or default to zh)
const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('lingjing-locale')) as 'zh' | 'en' | null
createI18n(saved || 'zh')

const { locale, t, messages } = useI18n()

function toggleLocale() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
  try { localStorage.setItem('lingjing-locale', locale.value) } catch {}
}
</script>

<template>
  <ParticleBackground />
  <MouseGlow />
  <button
    class="lang-switcher"
    :aria-label="t('lang.label')"
    :title="t('lang.label')"
    @click="toggleLocale"
  >
    {{ t('lang.switch') }}
  </button>
  <main>
    <HeroSection />
    <FeaturesSection />
    <TechArchSection />
    <StepsSection />
    <TestimonialsSection />
    <FooterSection />
  </main>
</template>

<style>
main {
  position: relative;
  z-index: var(--z-base);
}

.lang-switcher {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  padding: 8px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--color-neon-cyan);
  background: rgba(0, 245, 255, 0.06);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lang-switcher:hover {
  background: rgba(0, 245, 255, 0.12);
  border-color: rgba(0, 245, 255, 0.4);
  box-shadow: 0 0 16px rgba(0, 245, 255, 0.15);
}
</style>
