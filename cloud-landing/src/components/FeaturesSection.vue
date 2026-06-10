<script setup lang="ts">
import SectionWrapper from './SectionWrapper.vue'
import { Brain, Cpu, Sparkles, Shield, Zap, Globe } from 'lucide-vue-next'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const icons = [Brain, Cpu, Sparkles, Shield, Zap, Globe]
const tags = ['Core', 'HW', 'Ecosystem', 'Security', 'Collaboration', 'Cross-Platform']
</script>

<template>
  <SectionWrapper class="features" id="features">
    <div class="features__header">
      <span class="features__label">{{ t('features.label') }}</span>
      <h2 class="features__title">
        {{ t('features.titlePrefix') }}<span class="features__title-accent">{{ t('features.titleAccent') }}</span>
      </h2>
      <p class="features__desc">
        {{ t('features.desc') }}
      </p>
    </div>
    <div class="features__grid">
      <div
        v-for="(feature, i) in t('features.items')"
        :key="i"
        class="features__card"
        :style="{ '--card-index': i }"
        data-stagger
      >
        <div class="features__card-icon-wrap">
          <component :is="icons[i]" class="features__card-icon" :size="24" />
          <span class="features__card-tag">{{ tags[i] }}</span>
        </div>
        <h3 class="features__card-title">{{ feature.title }}</h3>
        <p class="features__card-desc">{{ feature.desc }}</p>
        <div class="features__card-line" aria-hidden="true" />
      </div>
    </div>
  </SectionWrapper>
</template>

<style scoped>
.features {
  padding: var(--space-3xl) var(--space-md);
  max-width: 1200px;
  margin: 0 auto;
}

.features__header {
  text-align: center;
  margin-bottom: var(--space-3xl);
}

.features__label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-neon-cyan);
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: var(--space-sm);
}

.features__title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.features__title-accent {
  background: linear-gradient(135deg, var(--color-neon-cyan), var(--color-neon-green));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.features__desc {
  color: var(--color-text-secondary);
  font-size: 1.05rem;
  margin-top: var(--space-md);
  max-width: 560px;
  margin-inline: auto;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

.features__card {
  position: relative;
  padding: var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
  overflow: hidden;
}

.features__card:hover {
  border-color: rgba(0, 245, 255, 0.3);
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.06), 0 8px 32px rgba(0, 0, 0, 0.3);
  transform: translateY(-4px);
}

.features__card-icon-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.features__card-icon {
  color: var(--color-neon-cyan);
}

.features__card-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 245, 255, 0.08);
  color: var(--color-neon-cyan);
  letter-spacing: 0.05em;
}

.features__card-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: var(--space-sm);
}

.features__card-desc {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.features__card-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-neon-cyan), var(--color-neon-purple));
  transition: width var(--transition-slow);
}

.features__card:hover .features__card-line {
  width: 100%;
}

@media (max-width: 1024px) {
  .features__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .features__grid {
    grid-template-columns: 1fr;
  }
  .features {
    padding: var(--space-2xl) var(--space-md);
  }
}
</style>