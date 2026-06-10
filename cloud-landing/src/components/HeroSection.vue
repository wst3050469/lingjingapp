<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useScrollAnimation } from '@/composables/useScrollAnimation'
import { useDeviceDetect } from '@/composables/useDeviceDetect'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const { isMobile } = useDeviceDetect()
const { prefersReducedMotion } = useReducedMotion()
const { elementRef, isVisible } = useScrollAnimation<HTMLElement>()

const scrollY = ref(0)
function onScroll() {
  scrollY.value = window.scrollY
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <section ref="elementRef" :class="['hero', { 'is-visible': isVisible }]" id="hero">
    <div class="hero__grid-overlay" aria-hidden="true" />
    <div class="hero__content">
      <div class="hero__badge" data-stagger>
        <span class="hero__badge-dot" />
        <span>{{ t('hero.badge') }}</span>
      </div>
      <h1 class="hero__title" data-stagger>
        <span class="hero__title-line">{{ t('hero.title') }}</span>
        <span class="hero__title-gradient">IDE</span>
      </h1>
      <p class="hero__subtitle" data-stagger>
        {{ t('hero.subtitle') }}<br/>
        <span class="hero__subtitle-dim">{{ t('hero.subtitleDim') }}</span>
      </p>
      <div class="hero__cta" data-stagger>
        <a href="/admin" class="hero__btn hero__btn--primary">
          <span class="hero__btn-text">{{ t('hero.cta') }}</span>
          <span class="hero__btn-glow" />
        </a>
        <a href="#features" class="hero__btn hero__btn--outline">
          <span class="hero__btn-text">{{ t('hero.ctaOutline') }}</span>
        </a>
      </div>
      <div class="hero__tech-strip" data-stagger aria-hidden="true">
        <span class="hero__tech-tag">TypeScript</span>
        <span class="hero__tech-tag">Vue3</span>
        <span class="hero__tech-tag">Electron</span>
        <span class="hero__tech-tag">AI Agent</span>
        <span class="hero__tech-tag">KiCad</span>
        <span class="hero__tech-tag">OpenSCAD</span>
      </div>
    </div>
    <div class="hero__scanline" aria-hidden="true" />
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: var(--space-xl) var(--space-md);
}

.hero__grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 245, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 245, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent);
}

.hero__content {
  position: relative;
  z-index: var(--z-above);
  text-align: center;
  max-width: 800px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 16px;
  border: 1px solid rgba(0, 245, 255, 0.25);
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-neon-cyan);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: var(--space-lg);
  background: rgba(0, 245, 255, 0.04);
  animation: border-glow 3s ease-in-out infinite;
}

.hero__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-neon-cyan);
  animation: neon-pulse 2s ease-in-out infinite;
}

.hero__title {
  font-size: clamp(3.5rem, 10vw, 7rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: var(--space-lg);
}

.hero__title-line {
  display: block;
  color: var(--color-text-primary);
}

.hero__title-gradient {
  display: block;
  background: linear-gradient(135deg, var(--color-neon-cyan) 0%, var(--color-neon-purple) 50%, var(--color-neon-pink) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 6s ease infinite, text-shimmer 4s linear infinite;
}

.hero__subtitle {
  font-size: clamp(1rem, 2.5vw, 1.35rem);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-xl);
  font-weight: 400;
}

.hero__subtitle-dim {
  color: var(--color-text-tertiary);
  font-size: 0.9em;
}

.hero__cta {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: var(--space-2xl);
}

.hero__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 36px;
  font-size: 1rem;
  font-weight: 600;
  font-family: var(--font-heading);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all var(--transition-base);
  overflow: hidden;
}

.hero__btn--primary {
  background: linear-gradient(135deg, var(--color-neon-cyan), var(--color-neon-blue));
  color: var(--color-bg-primary);
  border: none;
  animation: pulse-glow 3s ease-in-out infinite;
}

.hero__btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 40px rgba(0, 245, 255, 0.5), 0 0 100px rgba(0, 245, 255, 0.15);
}

.hero__btn--outline {
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.hero__btn--outline:hover {
  border-color: var(--color-neon-cyan);
  color: var(--color-neon-cyan);
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.15);
}

.hero__btn-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  transform: translateX(-100%);
}

.hero__btn--primary:hover .hero__btn-glow {
  transform: translateX(100%);
  transition: transform 0.6s ease;
}

.hero__tech-strip {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  flex-wrap: wrap;
  opacity: 0.5;
}

.hero__tech-tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.03em;
}

.hero__scanline {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.08), transparent);
  animation: scan-line 8s linear infinite;
  pointer-events: none;
}

.hero.is-visible [data-stagger] {
  animation: fade-in-up 0.7s ease-out both;
}
.hero.is-visible [data-stagger]:nth-child(1) { animation-delay: 0s; }
.hero.is-visible [data-stagger]:nth-child(2) { animation-delay: 0.1s; }
.hero.is-visible [data-stagger]:nth-child(3) { animation-delay: 0.2s; }
.hero.is-visible [data-stagger]:nth-child(4) { animation-delay: 0.3s; }
.hero.is-visible [data-stagger]:nth-child(5) { animation-delay: 0.4s; }

@media (max-width: 768px) {
  .hero__cta {
    flex-direction: column;
    align-items: center;
  }
  .hero__btn {
    width: 100%;
    max-width: 280px;
  }
  .hero__tech-strip {
    display: none;
  }
}
</style>