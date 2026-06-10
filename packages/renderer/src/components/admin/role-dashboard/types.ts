/** 租户角色类型（与服务端 tenant_role 对齐） */
export type TenantRole = 'owner' | 'admin' | 'project_manager' | 'worker' | 'technician' | 'member' | null;

/** 角色对应的中文名称 */
export const ROLE_LABELS: Record<string, string> = {
  owner: '租户管理员',
  admin: '租户管理员',
  project_manager: '项目经理',
  worker: '工人',
  technician: '技术员',
  member: '成员',
};

/** 用户资料（从 /api/v1/user/profile 获取） */
export interface UserProfile {
  nickname: string;
  tenant_id: string | null;
  company_name: string | null;
  tenant_role: TenantRole;
  owner_name: string | null;
  industry: { code: string; name: string } | null;
  account_type: string;
  welcome_chips: string[];
  pending_notifications: Array<{
    type: string;
    message: string;
    action_prompt: string;
    icon: string;
  }>;
}

/** 看板统计卡片 */
export interface StatsCard {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}

/** 快捷模块定义 */
export interface QuickModule {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}
