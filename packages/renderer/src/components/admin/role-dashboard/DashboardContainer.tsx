import React, { useState } from 'react';
import { RoleDashboard } from './RoleDashboard';

/**
 * 首页仪表盘容器组件
 * 独立于 AdminPanel，可直接在 SidebarContainer 中使用。
 * 从 localStorage 读取租户服务器地址，不依赖云管理后台登录。
 */
export function DashboardContainer() {
  const [tenantServerUrl, setTenantServerUrl] = useState<string>(
    () => localStorage.getItem('admin_tenant_server_url') || ''
  );

  return (
    <div className="h-full flex flex-col bg-cp-bg overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cp-border/40 bg-cp-sidebar shrink-0">
        <svg className="w-4 h-4 text-cp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
        <span className="text-sm font-medium text-cp-text">首页仪表盘</span>
        <div className="flex-1" />
        {/* 租户服务器地址快捷配置 */}
        <input
          type="text"
          value={tenantServerUrl}
          onChange={e => {
            setTenantServerUrl(e.target.value);
            localStorage.setItem('admin_tenant_server_url', e.target.value);
          }}
          placeholder="API地址"
          className="w-24 bg-cp-bg border border-cp-border/50 rounded px-1.5 py-0.5 text-[9px] text-cp-text outline-none focus:border-cp-accent text-right"
          title="租户API服务器地址"
        />
      </div>
      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-3">
        <RoleDashboard
          tenantServerUrl={tenantServerUrl}
        />
      </div>
    </div>
  );
}
