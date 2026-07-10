export interface AppAdminLoginRequest { username: string; password: string; }
export interface AppAdminLoginResponse { code: number; token: string; nickname: string; role: string; msg: string; }

export interface AppDashboardStats { total_users: number; active_users: number; total_tenants: number; active_tenants: number; recent_activities: AppAuditLogEntry[]; }

export interface AppTenant { tenant_id: string; company_name: string; industry: string; owner_name: string; owner_phone: string; plan: string; status: string; member_count: number; created_at: string; }
export interface AppTenantMember { user_id: string; name: string; phone: string; role: string; status: string; joined_at: string; last_login: string; ext_data: any; }

export interface AppUser { id: number; username: string; nickname: string; status: string; created_at: string; last_login_at: string; }

export interface AppVersion { id: number; version_name: string; version_code: number; release_notes: string; apk_filename: string; apk_size: number; is_force_update: boolean; uploaded_by: string; status: string; published_at: string; created_at: string; }
export interface AppAuditLogEntry { id: number; admin_id: number; admin_name: string; action: string; target_type: string; target_id: string; detail: string; ip_address: string; created_at: string; }
export interface AppInviteCode { id: number; code: string; nickname: string; status: string; created_at: string; }
export interface AppTeamInviteCode { id: number; code: string; tenant_id: string; company_name: string; target_role: string; max_uses: number; used_count: number; expires_at: string; status: string; created_by: string; created_at: string; }
export interface AppChatSession { session_id: string; title: string; invite_code: string; message_count: number; total_tokens: number; total_cost: number; last_user_msg: string; last_ai_msg: string; tenant_id: string; created_at: string; updated_at: string; }
export interface AppWsOnline { online_count: number; total_devices: number; online_users: string[]; note: string; }
export interface AppAutomationTask { id: number; tenant_id: string; name: string; task_type: string; cron_expr: string; description_nl: string; query_config: any; target_roles: string[]; is_enabled: boolean; last_run_at: string; next_run_at: string; created_by: string; execution_count: number; created_at: string; updated_at: string; }
