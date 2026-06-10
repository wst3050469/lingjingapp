<script setup lang="ts">
import SectionWrapper from './SectionWrapper.vue'
import ParallaxLayer from '@/effects/ParallaxLayer.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const colors = ['cyan', 'purple', 'green', 'blue'] as const
</script>

<template>
  <SectionWrapper class="tech-arch" id="tech-arch">
    <div class="tech-arch__header">
      <span class="tech-arch__label">{{ t('techArch.label') }}</span>
      <h2 class="tech-arch__title">
        {{ t('techArch.titlePrefix') }}<span class="tech-arch__title-accent">{{ t('techArch.titleAccent') }}</span>{{ t('techArch.titleSuffix') }}
      </h2>
    </div>
    <div class="tech-arch__diagram">
      <ParallaxLayer v-for="(item, i) in t('techArch.layers')" :key="i" :speed="0.1 + i * 0.05">
        <div class="tech-arch__layer" :class="`tech-arch__layer--${colors[i]}`" data-stagger>
          <div class="tech-arch__layer-index">{{ String(i + 1).padStart(2, '0') }}</div>
          <div class="tech-arch__layer-content">
            <h3 class="tech-arch__layer-title">{{ item.title }}</h3>
            <p class="tech-arch__layer-desc">{{ item.desc }}</p>
            <div class="tech-arch__layer-techs">
              <span class="tech-arch__tech">LLMProvider</span>
              <span class="tech-arch__tech">PromptEngine</span>
              <span class="tech-arch__tech">ToolRegistry</span>
            </div>
          </div>
          <div class="tech-arch__layer-glow" aria-hidden="true" />
        </div>
      </ParallaxLayer>
    </div>
  </SectionWrapper>
</template>

<style scoped>
.tech-arch {
  padding: var(--space-3xl) var(--space-md);
  max-width: 1000px;
  margin: 0 auto;
}

.tech-arch__header {
  text-align: center;
  margin-bottom: var(--space-3xl);
}

.tech-arch__label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-neon-purple);
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: var(--space-sm);
}

.tech-arch__title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
}

.tech-arch__title-accent {
  background: linear-gradient(135deg, var(--color-neon-purple), var(--color-neon-pink));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tech-arch__diagram {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tech-arch__layer {
  position: relative;
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
  overflow: hidden;
}

.tech-arch__layer:hover {
  transform: translateX(8px);
}

.tech-arch__layer--cyan:hover { border-color: rgba(0, 245, 255, 0.4); }
.tech-arch__layer--purple:hover { border-color: rgba(168, 85, 247, 0.4); }
.tech-arch__layer--green:hover { border-color: rgba(0, 255, 136, 0.4); }
.tech-arch__layer--blue:hover { border-color: rgba(77, 124, 255, 0.4); }

.tech-arch__layer-index {
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-bg-hover);
  line-height: 1;
  flex-shrink: 0;
}

.tech-arch__layer--cyan .tech-arch__layer-index { color: rgba(0, 245, 255, 0.15); }
.tech-arch__layer--purple .tech-arch__layer-index { color: rgba(168, 85, 247, 0.15); }
.tech-arch__layer--green .tech-arch__layer-index { color: rgba(0, 255, 136, 0.15); }
.tech-arch__layer--blue .tech-arch__layer-index { color: rgba(77, 124, 255, 0.15); }

.tech-arch__layer-content {
  flex: 1;
}

.tech-arch__layer-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.tech-arch__layer-desc {
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-md);
}

.tech-arch__layer-techs {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.tech-arch__tech {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  border: 1px solid var(--color-border);
}

.tech-arch__layer-glow {
  position: absolute;
  right: -50px;
  top: 50%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0;
  transition: opacity var(--transition-slow);
  pointer-events: none;
}

.tech-arch__layer--cyan .tech-arch__layer-glow { background: var(--color-neon-cyan); }
.tech-arch__layer--purple .tech-arch__layer-glow { background: var(--color-neon-purple); }
.tech-arch__layer--green .tech-arch__layer-glow { background: var(--color-neon-green); }
.tech-arch__layer--blue .tech-arch__layer-glow { background: var(--color-neon-blue); }

.tech-arch__layer:hover .tech-arch__layer-glow {
  opacity: 0.15;
}

@media (max-width: 768px) {
  .tech-arch__layer {
    flex-direction: column;
    gap: var(--space-sm);
  }
  .tech-arch__layer:hover {
    transform: none;
  }
}
</style>