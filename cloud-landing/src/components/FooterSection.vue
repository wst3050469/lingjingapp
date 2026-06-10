<script setup lang="ts">
const currentYear = new Date().getFullYear()

const links = [
  { label: '文档', href: '/admin' },
  { label: 'GitHub', href: 'https://github.com/lingjing' },
  { label: '联系我们', href: 'mailto:contact@zhejiangjinmo.com' },
]
</script>

<template>
  <footer class="footer">
    <div class="footer__divider" aria-hidden="true" />
    <div class="footer__content">
      <div class="footer__brand">
        <span class="footer__logo">灵境<span class="footer__logo-accent">IDE</span></span>
        <p class="footer__tagline">AI驱动的智能开发环境</p>
      </div>
      <nav class="footer__nav">
        <a v-for="link in links" :key="link.label" :href="link.href" class="footer__link">
          {{ link.label }}
        </a>
      </nav>
      <div class="footer__copy">
        &copy; {{ currentYear }} 灵境IDE &middot; 浙江金魔科技有限公司
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  padding: var(--space-2xl) var(--space-md) var(--space-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.footer__divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.2), rgba(168, 85, 247, 0.2), transparent);
  margin-bottom: var(--space-2xl);
}

.footer__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  text-align: center;
}

.footer__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.footer__logo {
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.footer__logo-accent {
  background: linear-gradient(135deg, var(--color-neon-cyan), var(--color-neon-purple));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.footer__tagline {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.footer__nav {
  display: flex;
  gap: var(--space-xl);
}

.footer__link {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer__link:hover {
  color: var(--color-neon-cyan);
}

.footer__copy {
  font-size: 0.78rem;
  color: var(--color-text-tertiary);
}

@media (max-width: 768px) {
  .footer__nav {
    gap: var(--space-md);
  }
}
</style>