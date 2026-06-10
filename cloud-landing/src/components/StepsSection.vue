<script setup lang="ts">
import SectionWrapper from './SectionWrapper.vue'
import { Download, Settings, Rocket } from 'lucide-vue-next'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const icons = [Download, Settings, Rocket]
</script>

<template>
  <SectionWrapper class="steps" id="steps">
    <div class="steps__header">
      <span class="steps__label">{{ t('steps.label') }}</span>
      <h2 class="steps__title">
        {{ t('steps.titlePrefix') }}<span class="steps__title-accent">{{ t('steps.titleAccent') }}</span>
      </h2>
    </div>
    <div class="steps__list">
      <div v-for="(step, i) in t('steps.items')" :key="i" class="steps__item" data-stagger>
        <div class="steps__item-connector" aria-hidden="true">
          <div class="steps__item-dot" />
          <div v-if="i < t('steps.items').length - 1" class="steps__item-line" />
        </div>
        <div class="steps__item-body">
          <div class="steps__item-icon-wrap">
            <component :is="icons[i]" class="steps__item-icon" :size="22" />
          </div>
          <h3 class="steps__item-title">{{ step.title }}</h3>
          <p class="steps__item-desc">{{ step.desc }}</p>
          <code class="steps__item-code">{{ step.code }}</code>
        </div>
      </div>
    </div>
  </SectionWrapper>
</template>

<style scoped>
.steps {
  padding: var(--space-3xl) var(--space-md);
  max-width: 800px;
  margin: 0 auto;
}

.steps__header {
  text-align: center;
  margin-bottom: var(--space-3xl);
}

.steps__label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-neon-green);
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: var(--space-sm);
}

.steps__title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
}

.steps__title-accent {
  background: linear-gradient(135deg, var(--color-neon-green), var(--color-neon-cyan));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.steps__list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.steps__item {
  display: flex;
  gap: var(--space-xl);
}

.steps__item-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 40px;
}

.steps__item-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-neon-cyan);
  box-shadow: 0 0 12px rgba(0, 245, 255, 0.4);
  flex-shrink: 0;
}

.steps__item-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(to bottom, rgba(0, 245, 255, 0.3), rgba(0, 245, 255, 0.05));
  min-height: 60px;
}

.steps__item-body {
  padding-bottom: var(--space-2xl);
}

.steps__item-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: rgba(0, 245, 255, 0.08);
  border: 1px solid rgba(0, 245, 255, 0.15);
  margin-bottom: var(--space-md);
}

.steps__item-icon {
  color: var(--color-neon-cyan);
}

.steps__item-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.steps__item-desc {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-md);
}

.steps__item-code {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  padding: 8px 16px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-neon-green);
}

@media (max-width: 768px) {
  .steps__item-connector {
    width: 30px;
  }
  .steps__item {
    gap: var(--space-md);
  }
}
</style>