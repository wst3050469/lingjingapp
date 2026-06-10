<script setup lang="ts">
import SectionWrapper from './SectionWrapper.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const statSuffixes = ['+', '%', '+', 's']
const statValues = ['10,000', '99.9', '50', '<2']
</script>

<template>
  <SectionWrapper class="testimonials" id="testimonials">
    <div class="testimonials__stats" data-stagger>
      <div v-for="(label, i) in t('testimonials.stats')" :key="i" class="testimonials__stat">
        <span class="testimonials__stat-value">{{ statValues[i] }}</span>
        <span class="testimonials__stat-suffix">{{ statSuffixes[i] }}</span>
        <span class="testimonials__stat-label">{{ label }}</span>
      </div>
    </div>
    <div class="testimonials__header">
      <span class="testimonials__label">{{ t('testimonials.label') }}</span>
      <h2 class="testimonials__title">
        {{ t('testimonials.titlePrefix') }}<span class="testimonials__title-accent">{{ t('testimonials.titleAccent') }}</span>
      </h2>
    </div>
    <div class="testimonials__grid">
      <div
        v-for="(item, i) in t('testimonials.quotes')"
        :key="i"
        class="testimonials__card"
        data-stagger
      >
        <div class="testimonials__card-quote" aria-hidden="true">"</div>
        <p class="testimonials__card-text">{{ item.text }}</p>
        <div class="testimonials__card-author">
          <div class="testimonials__card-avatar">{{ item.author[0] }}</div>
          <div>
            <div class="testimonials__card-name">{{ item.author }}</div>
            <div class="testimonials__card-role">{{ item.role }}</div>
          </div>
        </div>
      </div>
    </div>
  </SectionWrapper>
</template>

<style scoped>
.testimonials {
  padding: var(--space-3xl) var(--space-md);
  max-width: 1200px;
  margin: 0 auto;
}

.testimonials__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-lg);
  margin-bottom: var(--space-3xl);
  padding: var(--space-xl) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.testimonials__stat {
  text-align: center;
}

.testimonials__stat-value {
  font-family: var(--font-mono);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-neon-cyan), var(--color-neon-green));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.testimonials__stat-suffix {
  font-family: var(--font-mono);
  font-size: clamp(1rem, 2vw, 1.5rem);
  font-weight: 700;
  color: var(--color-neon-cyan);
}

.testimonials__stat-label {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-top: var(--space-xs);
}

.testimonials__header {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.testimonials__label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-neon-orange);
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: var(--space-sm);
}

.testimonials__title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
}

.testimonials__title-accent {
  background: linear-gradient(135deg, var(--color-neon-orange), var(--color-neon-pink));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.testimonials__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

.testimonials__card {
  position: relative;
  padding: var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.testimonials__card:hover {
  border-color: rgba(168, 85, 247, 0.3);
  box-shadow: 0 0 30px rgba(168, 85, 247, 0.06);
}

.testimonials__card-quote {
  font-size: 4rem;
  font-weight: 900;
  color: rgba(168, 85, 247, 0.1);
  line-height: 1;
  position: absolute;
  top: 12px;
  left: 20px;
}

.testimonials__card-text {
  font-size: 0.92rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-lg);
  position: relative;
  z-index: 1;
}

.testimonials__card-author {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.testimonials__card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-neon-purple), var(--color-neon-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-bg-primary);
  flex-shrink: 0;
}

.testimonials__card-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.testimonials__card-role {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

@media (max-width: 1024px) {
  .testimonials__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .testimonials__stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .testimonials__grid {
    grid-template-columns: 1fr;
  }
  .testimonials__stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>