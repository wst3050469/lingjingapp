export default {
  // Hero
  hero: {
    badge: 'AI-Powered IDE',
    title: 'LingJing',
    subtitle: 'Next-Generation AI-Powered Development Environment',
    subtitleDim: 'Make every coding session more efficient, intelligent, and free',
    cta: 'Get Started',
    ctaOutline: 'Learn More',
  },
  // Features
  features: {
    label: '// CORE CAPABILITIES',
    titlePrefix: 'Redefining the',
    titleAccent: 'Development Experience',
    desc: 'Six core capabilities, building a complete intelligent development loop from software to hardware, from local to cloud',
    items: [
      {
        title: 'AI-Powered Coding',
        desc: 'Deep code context understanding, intelligent completion, refactoring, and debugging. Let AI be your most capable programming partner.',
      },
      {
        title: 'Hardware Design',
        desc: 'Built-in KiCad, OpenSCAD, Wokwi skill packs. AI-assisted schematic generation and DRC fixing.',
      },
      {
        title: 'Skill Marketplace',
        desc: 'Open skill marketplace. One-click install community skill packs. Extend IDE capabilities on demand.',
      },
      {
        title: 'Secure Sandboxing',
        desc: 'Each skill pack runs in an isolated sandbox. CLI whitelist control. Full-chain security scanning.',
      },
      {
        title: 'Real-Time Collaboration',
        desc: 'Mobile remote approval and control. WebSocket real-time status sync. Stay in control of your development from anywhere.',
      },
      {
        title: 'Cross-Platform Experience',
        desc: 'Desktop Electron + Mobile Web + Cloud services. Three-platform data sync with seamless session switching.',
      },
    ],
  },
  // TechArch
  techArch: {
    label: '// ARCHITECTURE',
    titlePrefix: 'Four-Layer',
    titleAccent: 'Architecture',
    titleSuffix: '',
    layers: [
      {
        title: 'AI Inference Layer',
        desc: 'Multi-model Provider architecture with seamless switching between DeepSeek, OpenAI, and local models',
      },
      {
        title: 'Skill Execution Layer',
        desc: 'CLI Adapter + Web API Adapter dual-channel. Secure sandboxing with whitelist control.',
      },
      {
        title: 'Data Persistence Layer',
        desc: 'SQLite WASM + AES-256-GCM encrypted checkpoints + LRU session management',
      },
      {
        title: 'Communication Layer',
        desc: 'WebSocket Gateway + SSE Push + Mobile remote approval bridge',
      },
    ],
  },
  // Steps
  steps: {
    label: '// GET STARTED',
    titlePrefix: 'Get Started in',
    titleAccent: '3 Steps',
    items: [
      {
        title: 'Install LingJing IDE',
        desc: 'Download the desktop client or access the cloud version directly via browser. Zero configuration, start instantly.',
        code: '$ pnpm install @lingjing/ide',
      },
      {
        title: 'Configure AI',
        desc: 'Connect your DeepSeek or OpenAI API Key. Choose your model and enable intelligent coding assistance.',
        code: 'AI_PROVIDER=deepseek',
      },
      {
        title: 'Start Coding',
        desc: 'AI understands your code context. Auto-completion, refactoring suggestions, bug fixes — all at your fingertips.',
        code: 'LingJing IDE> Let\'s code ✨',
      },
    ],
  },
  // Testimonials
  testimonials: {
    label: '// TESTIMONIALS',
    titlePrefix: 'Real',
    titleAccent: 'Developer Feedback',
    stats: ['Developers', 'Uptime', 'Skill Packs', 'Cold Start'],
    quotes: [
      {
        text: 'LingJing IDE\'s AI assistance tripled my efficiency in hardware design projects, with DRC fix suggestion accuracy exceeding 85%.',
        author: 'Zhang Wei',
        role: 'Hardware Engineer · Chip Company',
      },
      {
        text: 'The skill marketplace ecosystem is amazing. One-click install KiCad skill pack, AI directly generates schematics — unimaginable before.',
        author: 'Li Ming',
        role: 'Full-Stack Developer · Indie',
      },
      {
        text: 'The mobile approval feature solved my pain point — I can handle Agent permission requests during my commute.',
        author: 'Wang Ying',
        role: 'Tech Director · AI Startup',
      },
    ],
  },
  // Footer
  footer: {
    tagline: 'AI-Powered Intelligent Development Environment',
    links: ['Docs', 'GitHub', 'Contact'],
    copyright: 'LingJing IDE · Zhejiang Jinmo Technology Co., Ltd.',
  },
  // Language switcher
  lang: {
    switch: '中文',
    label: 'Language',
  },
};
