export interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; }
export interface ApiResponse<T> { success: boolean; data: T; error?: string; }
export interface ApiErrorResponse { success: false; error: string; status: number; }
export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { token: string; username: string; }
export interface AdminUser { username: string; role: string; }
export interface Device { id: string; user_id: string; device_type: string; device_name: string; push_token: string; is_active: boolean; last_connected_at: string; created_at: string; }
export interface Session { session_id: string; type: string; status: string; task_title: string; turn_count: number; updated_at: string; }
export interface Skill { id: string; name: string; description: string; category: string; version: string; rating: number; install_count: number; security_status: string; }
export interface Memory { id: string; scope: string; category: string; title: string; content: string; source: string; created_at: string; updated_at: string; }
export interface PushNotification { id: string; type: string; session_id: string; device_id: string; title: string; summary: string; delivery_status: string; created_at: string; }
export interface Defect { id: string; severity: string; module: string; title: string; description: string; status: string; fix_description: string; created_at: string; }
export interface Schedule { id: string; name: string; cron: string; action: string; enabled: boolean; last_run: string; created_at: string; }
export interface ApiKey { id: string; name: string; key_preview: string; permissions: string[]; created_at: string; }
export interface Version { id: string; version: string; status: string; changelog: string; downloadUrl?: string; files: Record<string, string>; locked: boolean; submitter?: string; reviewer?: string; submittedAt?: string; reviewedAt?: string; rejectReason?: string; releaseDate?: string; active?: boolean; created_at: string; updated_at?: string; }
export interface AuditLogEntry { id: string; action: string; user: string; target: string; timestamp: string; }
export interface AuditLogRecord { id: number; user: string; ip: string; method: string; path: string; status_code: number; duration_ms: number; created_at: string; }
export interface Payment { id: string; amount: number; status: string; method: string; created_at: string; }
export interface Subscription { id: string; plan_name: string; status: string; expires_at: string; }
export interface Invoice { id: string; amount: number; status: string; created_at: string; }
