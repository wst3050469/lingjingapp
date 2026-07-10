export interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; }
export interface ApiResponse<T> { code: number; data: T; msg?: string; }
export interface ApiErrorResponse { code: number; msg: string; }

export interface AppAdminLoginRequest { username: string; password: string; }
export interface AppAdminLoginResponse { code: number; token: string; nickname: string; role: string; msg: string; }
export interface AppAdminUser { id: number; username: string; nickname: string; role: string; status: string; }

export interface AppDashboardStats { total_users: number; active_users: number; total_tenants: number; active_tenants: number; total_contracts: number; total_suppliers: number; total_customers: number; pending_approvals: number; recent_activities: AppAuditLogEntry[]; }

export interface AppTenant { tenant_id: string; company_name: string; industry: string; owner_name: string; owner_phone: string; plan: string; status: string; member_count: number; created_at: string; }
export interface AppTenantMember { user_id: string; name: string; phone: string; role: string; status: string; joined_at: string; last_login: string; ext_data: any; }

export interface AppUser { id: number; username: string; nickname: string; status: string; created_at: string; last_login_at: string; }

export interface AppContract { id: number; name: string; tenant_id: string; project_id: number | null; contract_no: string; title: string; party_a: string; party_b: string; amount: number; sign_date: string | null; start_date: string | null; end_date: string | null; status: string; file_url: string; created_at: string; updated_at: string; }
export interface AppSupplier { id: number; name: string; tenant_id: string; contact_person: string; phone: string; category: string; material_type: string; business_type: string; status: string; rating: number; address: string; notes: string; created_at: string; updated_at: string; }
export interface AppCustomer { id: number; name: string; tenant_id: string; contact_person: string; phone: string; company: string; source: string; status: string; notes: string; created_at: string; updated_at: string; }
export interface AppInvoice { id: number; tenant_id: string; invoice_no: string; invoice_type: string; title: string; customer_id: number | null; supplier_id: number | null; customer_name: string; supplier_name: string; amount: number; tax_amount: number; total_amount: number; tax_rate: number; invoice_date: string | null; issue_date: string | null; due_date: string | null; status: string; payment_status: string; invoice_category: string; remarks: string; project_id: number | null; contract_id: number | null; file_ids: string; created_by: number | null; created_at: string; updated_at: string; }
export interface AppFinance { id: number; tenant_id: string; project_id: number | null; ext_id: string; type: string; category: string; amount: number; applicant_name: string; status: string; reason: string; approved_by: string; approved_at: string | null; supplier_name: string; material_desc: string; expense_date: string | null; file_ids: string; last_synced_at: string | null; created_at: string; updated_at: string; }

export interface AppVersion { id: number; version_name: string; version_code: number; release_notes: string; apk_filename: string; apk_size: number; is_force_update: boolean; uploaded_by: string; status: string; published_at: string; created_at: string; }
export interface AppAuditLogEntry { id: number; admin_id: number; admin_name: string; action: string; target_type: string; target_id: string; detail: string; ip_address: string; created_at: string; }
export interface AppInviteCode { id: number; code: string; nickname: string; status: string; created_at: string; }
export interface AppTeamInviteCode { id: number; code: string; tenant_id: string; company_name: string; target_role: string; max_uses: number; used_count: number; expires_at: string; status: string; created_by: string; created_at: string; }
export interface AppChatSession { session_id: string; title: string; invite_code: string; message_count: number; total_tokens: number; total_cost: number; last_user_msg: string; last_ai_msg: string; tenant_id: string; created_at: string; updated_at: string; }
export interface ApiListResponse<T> { code: number; data: T[]; total?: number; msg?: string; }
export interface AppSample { id: number; tenant_id: string; project_id: number | null; customer_name: string; recipe_name: string | null; specs: string; status: string; created_by: string; created_at: string; updated_at: string; notes: string; recipe_id: number | null; project_name: string | null; image_url: string; file_ids: string; phase: string; }
export interface AppRecipe { id: string; tenant_id: string; name: string; description: string; ingredients: string; steps: string; category: string; status: string; created_by: number; created_at: string; updated_at: string; company_name: string; }
export interface AppWsOnline { online_count: number; total_devices: number; online_users: string[]; note: string; }
export interface AppWsConnection { id: string; user_id: string; connected_at: string; }
export interface AppAutomationTask { id: number; tenant_id: string; name: string; task_type: string; cron_expr: string; description_nl: string; query_config: any; target_roles: string[]; is_enabled: boolean; last_run_at: string; next_run_at: string; created_by: string; execution_count: number; created_at: string; updated_at: string; }
