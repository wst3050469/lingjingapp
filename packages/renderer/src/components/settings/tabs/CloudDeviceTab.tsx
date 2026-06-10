import { ExternalLink } from 'lucide-react';

const CLOUD_ADMIN_URL = 'https://lingjing.zhejiangjinmo.com/admin';

const sections = [
  {
    title: '📱 设备管理',
    desc: '查看和管理已注册的 IDE 设备、在线状态、最后活跃时间',
    link: '/devices',
  },
  {
    title: '🔑 API 密钥',
    desc: '创建、查看和撤销 API 密钥，用于客户端认证和授权',
    link: '/api-keys',
  },
  {
    title: '📊 仪表板',
    desc: '查看系统概览、用户统计、服务健康状态',
    link: '/',
  },
  {
    title: '👥 用户管理',
    desc: '管理用户账号、角色分配、启用/禁用',
    link: '/users',
  },
];

export function CloudDeviceTab() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
          云管理功能已迁移至云端管理后台。请通过下方链接访问管理后台进行操作。
        </p>
      </div>

      {/* Main CTA */}
      <div className="bg-gradient-to-br from-cp-accent/5 to-blue-500/5 border border-cp-accent/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-cp-accent/20 flex items-center justify-center">
            <span className="text-xl">☁️</span>
          </div>
          <div>
            <h3 className="text-sm text-cp-text font-medium">灵境云管理后台</h3>
            <p className="text-[10px] text-cp-text-dim/40">https://lingjing.zhejiangjinmo.com/admin</p>
          </div>
        </div>
        <p className="text-xs text-cp-text-dim/60 mb-4 leading-relaxed">
          设备管理、API 密钥、用户管理、订阅管理等功能已迁移至云端。
          点击下方按钮在浏览器中打开管理后台。
        </p>
        <button
          onClick={() => window.open(CLOUD_ADMIN_URL, '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 rounded-lg text-xs font-medium transition-colors"
        >
          <ExternalLink size={14} />
          打开管理后台
        </button>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map((section) => (
          <button
            key={section.link}
            onClick={() => window.open(CLOUD_ADMIN_URL + section.link, '_blank')}
            className="text-left bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 hover:bg-white/[0.06] hover:border-cp-accent/30 transition-all group"
          >
            <h4 className="text-sm text-cp-text font-medium mb-1">{section.title}</h4>
            <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">{section.desc}</p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-cp-accent/60 group-hover:text-cp-accent transition-colors">
              <span>前往管理</span>
              <ExternalLink size={10} />
            </div>
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-[11px] text-yellow-400/70 leading-relaxed">
          ⚠️ 旧版 IDE 内嵌云管理功能已弃用，所有云管理操作请通过云端管理后台完成。
          如果遇到登录问题，请先访问管理后台登录页面进行认证。
        </p>
      </div>
    </div>
  );
}
