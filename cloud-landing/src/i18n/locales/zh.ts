export default {
  // Hero
  hero: {
    badge: 'AI-Powered IDE',
    title: '灵境',
    subtitle: '下一代 AI 驱动的智能开发环境',
    subtitleDim: '让每一次编码都更高效、更智能、更自由',
    cta: '开始使用',
    ctaOutline: '了解更多',
  },
  // Features
  features: {
    label: '// CORE CAPABILITIES',
    titlePrefix: '重新定义',
    titleAccent: '开发体验',
    desc: '六大核心能力，构建从软件到硬件、从本地到云端的完整智能开发闭环',
    items: [
      {
        title: 'AI 驱动编码',
        desc: '深度理解代码上下文，智能补全、重构与调试，让 AI 成为你最得力的编程搭档',
      },
      {
        title: '硬件设计赋能',
        desc: '内置 KiCad、OpenSCAD、Wokwi 技能包，AI 辅助原理图生成与 DRC 修复',
      },
      {
        title: '技能市场生态',
        desc: '开放技能市场，一键安装社区技能包，按需扩展 IDE 能力边界',
      },
      {
        title: '安全沙箱执行',
        desc: '每个技能包独立沙箱运行，CLI 白名单控制，安全扫描全链路保障',
      },
      {
        title: '实时协作同步',
        desc: '移动端远程审批与控制，WebSocket 实时状态同步，随时随地掌控开发进程',
      },
      {
        title: '多平台无缝体验',
        desc: '桌面端 Electron + 移动端 Web + 云端服务，三端数据互通、会话无缝切换',
      },
    ],
  },
  // TechArch
  techArch: {
    label: '// ARCHITECTURE',
    titlePrefix: '四层',
    titleAccent: '架构',
    titleSuffix: '设计',
    layers: [
      {
        title: 'AI 推理层',
        desc: '多模型 Provider 架构，支持 DeepSeek / OpenAI / 本地模型无缝切换',
      },
      {
        title: '技能执行层',
        desc: 'CLI 适配器 + Web API 适配器双通道，安全沙箱 + 白名单控制',
      },
      {
        title: '数据持久层',
        desc: 'SQLite WASM + AES-256-GCM 加密检查点 + LRU 会话管理',
      },
      {
        title: '通信协同层',
        desc: 'WebSocket 网关 + SSE 推送 + 移动端远程审批桥接',
      },
    ],
  },
  // Steps
  steps: {
    label: '// GET STARTED',
    titlePrefix: '三步',
    titleAccent: '启动',
    items: [
      {
        title: '安装灵境IDE',
        desc: '下载桌面客户端或直接通过浏览器访问云端版本，零配置即刻开始',
        code: '$ pnpm install @lingjing/ide',
      },
      {
        title: '配置 AI 能力',
        desc: '接入 DeepSeek 或 OpenAI API Key，选择模型，开启智能编码辅助',
        code: 'AI_PROVIDER=deepseek',
      },
      {
        title: '开始智能开发',
        desc: 'AI 理解你的代码上下文，自动补全、重构建议、Bug 修复，一触即发',
        code: '灵境IDE> 开始编码 ✨',
      },
    ],
  },
  // Testimonials
  testimonials: {
    label: '// TESTIMONIALS',
    titlePrefix: '开发者的',
    titleAccent: '真实反馈',
    stats: ['开发者', '服务可用性', '技能包', '冷启动时间'],
    quotes: [
      {
        text: '灵境IDE的AI辅助让我在硬件设计项目中效率提升了3倍，DRC修复建议准确率超过85%。',
        author: '张工',
        role: '硬件工程师 · 某芯片公司',
      },
      {
        text: '技能市场生态太棒了，一键安装KiCad技能包，AI直接帮我生成原理图，这在以前不敢想。',
        author: '李明',
        role: '全栈开发者 · 独立开发',
      },
      {
        text: '移动端审批功能解决了我的痛点——通勤路上就能处理Agent的权限请求。',
        author: '王颖',
        role: '技术总监 · 某AI创业公司',
      },
    ],
  },
  // Footer
  footer: {
    tagline: 'AI驱动的智能开发环境',
    links: ['文档', 'GitHub', '联系我们'],
    copyright: '灵境IDE · 浙江金魔科技有限公司',
  },
  // Language switcher
  lang: {
    switch: 'EN',
    label: '语言',
  },
};
