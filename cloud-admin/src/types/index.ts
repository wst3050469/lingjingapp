export interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; }
export interface ApiResponse<T> { code: number; data: T; msg?: string; }
export interface ApiErrorResponse { code: number; msg: string; }

export interface AppAdminLoginRequest { username: string; password: string; }
export interface AppAdminLoginResponse { code: number; token: string; nickname: string; role: string; msg: string; }
export interface AppAdminUser { id: number; username: string; nickname: string; role: string; status: string; }

export interface AppDashboardStats { total_users: number; active_users: number; total_tenants: number; active_tenants: number; total_contracts: number; total_suppliers: number; total_customers: number; pending_approvals: number; recent_activities: AppAuditLogEntry[]; }

export interface AppTenant { tenant_id: string; company_name: string; industry: string; owner_name: string; owner_phone: string; plan: string; status: string; member_count: number; created_at: string; }
export interface AppTenantMember { user_id: string; name: string; phone: string; role: string; status: string; joined_at: string; last_login: string; ext_data: any; }

export interface AppUser { id: number; username: string; nickname: string; account_type: string; tenant_id: string; company_name: string; industry: string; status: string; created_at: string; }

export interface AppContract { contract_id: number; tenant_id: string; title: string; party_a: string; party_b: string; amount: number; status: string; signed_at: string; created_at: string; }
export interface AppSupplier { supplier_id: number; tenant_id: string; name: string; contact: string; phone: string; address: string; status: string; created_at: string; }
export interface AppCustomer { customer_id: number; tenant_id: string; name: string; contact: string; phone: string; address: string; level: string; created_at: string; }
export interface AppInvoice { invoice_id: number; tenant_id: string; title: string; amount: number; invoice_type: string; status: string; invoice_date: string; created_at: string; }
export interface AppFinance { record_id: number; tenant_id: string; type: string; amount: number; category: string; description: string; record_date: string; created_at: string; }

export interface AppVersion { id: number; version: string; platform: string; file_url: string; file_size: number; changelog: string; status: string; created_at: string; }
export interface AppAuditLogEntry { id: number; admin_id: number; admin_name: string; action: string; target_type: string; target_id: string; detail: string; created_at: string; }
export interface AppInviteCode { id: number; code: string; nickname: string; status: string; created_at: string; }
export interface AppTeamInviteCode { id: number; code: string; target_role: string; max_uses: number; used_count: number; status: string; created_at: string; }
export interface AppChatSession { id: string; title: string; status: string; user_id: string; created_at: string; }
export interface AppSample { id: number; name: string; description: string; category: string; content: string; created_at: string; }
export interface AppRecipe { recipe_id: string; name: string; category: string; description: string; steps: string; created_at: string; }
export interface AppWsOnline { count: number; connections: AppWsConnection[]; }
export interface AppWsConnection { id: string; user_id: string; connected_at: string; }
export interface AppAutomationTask { id: number; tenant_id: string; name: string; trigger_type: string; action_type: string; config: any; enabled: boolean; last_run: string; created_at: string; }
