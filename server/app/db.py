"""灵境 - 数据库操作层"""
import asyncpg
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, List, Dict
import os

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', '')

pool: asyncpg.Pool = None

async def init_db():
    """初始化数据库连接池"""
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=2,
        max_size=20,
        command_timeout=60,
        max_inactive_connection_lifetime=300.0,
    )
    await create_tables()
    # 启动连接池健康检查
    global _pool_health_task
    _pool_health_task = asyncio.create_task(_pool_health_loop())
    logger.info("数据库连接池初始化完成 (min=2, max=20)")

async def close_db():
    """关闭数据库连接池"""
    global pool, _pool_health_task
    if _pool_health_task:
        _pool_health_task.cancel()
        _pool_health_task = None
    if pool:
        await pool.close()
        pool = None
    logger.info("数据库连接池已关闭")

async def _pool_health_loop():
    """数据库连接池健康检查：每60秒检查一次连接可用性"""
    global pool
    while True:
        try:
            await asyncio.sleep(60)
            if pool is None:
                continue
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"数据库连接池健康检查失败: {e}")
            try:
                if pool:
                    await pool.close()
                pool = await asyncpg.create_pool(
                    DATABASE_URL,
                    min_size=2,
                    max_size=20,
                    command_timeout=60,
                    max_inactive_connection_lifetime=300.0,
                )
                logger.info("数据库连接池已自动重建")
            except Exception as re:
                logger.critical(f"数据库连接池重建失败: {re}")

async def create_tables():
    """创建表结构（兼容现有 v1.12.0 schema）"""
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                parent_id UUID,
                name VARCHAR(100) NOT NULL,
                level INT DEFAULT 1,
                path TEXT,
                manager_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                name VARCHAR(200) NOT NULL,
                no VARCHAR(50) UNIQUE,
                project_status VARCHAR(50) DEFAULT 'pending',
                owner_id INTEGER,
                manager_id INTEGER,
                progress FLOAT DEFAULT 0,
                budget FLOAT DEFAULT 0,
                start_date DATE,
                deadline DATE,
                address VARCHAR(500),
                description TEXT,
                config JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                record_status VARCHAR(20) DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS project_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER,
                role VARCHAR(50) DEFAULT 'member',
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(project_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                project_id UUID REFERENCES projects(id),
                title VARCHAR(500) NOT NULL,
                description TEXT,
                assignee_id INTEGER,
                creator_id INTEGER,
                priority VARCHAR(20) DEFAULT 'normal',
                task_status VARCHAR(50) DEFAULT 'pending',
                progress FLOAT DEFAULT 0,
                start_date DATE,
                due_date DATE,
                completed_at TIMESTAMPTZ,
                config JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                record_status VARCHAR(20) DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER,
                project_id UUID,
                type VARCHAR(20) DEFAULT 'check_in',
                check_time TIMESTAMPTZ DEFAULT NOW(),
                latitude FLOAT,
                longitude FLOAT,
                address VARCHAR(500),
                photo_url VARCHAR(500),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS approval_flows (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                code VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                object_type VARCHAR(50) DEFAULT 'any',
                steps JSONB DEFAULT '[]',
                conditions JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                status VARCHAR(20) DEFAULT 'active',
                UNIQUE(tenant_id, code)
            );

            CREATE TABLE IF NOT EXISTS approvals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                flow_id UUID,
                record_id UUID,
                applicant_id INTEGER,
                title VARCHAR(500) NOT NULL,
                amount FLOAT DEFAULT 0,
                current_step INT DEFAULT 1,
                steps_data JSONB DEFAULT '[]',
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                resolved_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS approval_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                approval_id UUID,
                step INT,
                approver_id INTEGER,
                action VARCHAR(20),
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER,
                tenant_id VARCHAR(32),
                action VARCHAR(50),
                target_type VARCHAR(50),
                target_id UUID,
                detail JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL,
                admin_name VARCHAR(100),
                action VARCHAR(50) NOT NULL,
                target_type VARCHAR(50),
                target_id VARCHAR(100),
                detail TEXT,
                ip_address VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
            CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);

            CREATE TABLE IF NOT EXISTS recipes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                name VARCHAR(200) NOT NULL,
                description TEXT,
                ingredients JSONB DEFAULT '[]',
                steps JSONB DEFAULT '[]',
                category VARCHAR(100),
                status VARCHAR(20) DEFAULT 'active',
                created_by INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS template_images (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                name VARCHAR(200) NOT NULL,
                description TEXT,
                image_url VARCHAR(500) NOT NULL,
                category VARCHAR(100),
                tags TEXT[] DEFAULT '{}',
                created_by INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                target_user_id VARCHAR(64) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                title VARCHAR(500) NOT NULL,
                body TEXT DEFAULT '',
                ref_type VARCHAR(50) DEFAULT '',
                ref_id VARCHAR(100) DEFAULT '',
                priority INT DEFAULT 50,
                is_read BOOLEAN DEFAULT FALSE,
                extras JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS user_todo_counts (
                user_id VARCHAR(64) PRIMARY KEY,
                unread_count INT DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 自动化任务引擎
            CREATE TABLE IF NOT EXISTS automated_tasks (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                name VARCHAR(100) NOT NULL,
                description_nl TEXT NOT NULL DEFAULT '',
                cron_expr VARCHAR(80) NOT NULL,
                task_type VARCHAR(50) NOT NULL DEFAULT 'custom',
                query_config JSONB NOT NULL DEFAULT '{}',
                target_roles TEXT[] NOT NULL DEFAULT ARRAY['owner','admin'],
                is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                last_run_at TIMESTAMPTZ,
                next_run_at TIMESTAMPTZ,
                created_by VARCHAR(64),
                execution_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_auto_tasks_tenant ON automated_tasks(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_auto_tasks_next_run ON automated_tasks(is_enabled, next_run_at);

            CREATE TABLE IF NOT EXISTS automated_task_logs (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES automated_tasks(id) ON DELETE CASCADE,
                tenant_id VARCHAR(64) NOT NULL,
                executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                status VARCHAR(20) NOT NULL DEFAULT 'success',
                report_text TEXT NOT NULL DEFAULT '',
                error_message TEXT,
                duration_ms INT
            );
            CREATE INDEX IF NOT EXISTS idx_auto_logs_task ON automated_task_logs(task_id, executed_at DESC);

            CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
            CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
            CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON recipes(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
            CREATE INDEX IF NOT EXISTS idx_template_images_tenant ON template_images(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_template_images_category ON template_images(category);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(target_user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(target_user_id, is_read);
            CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, event_type);

            -- 发票管理
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id) NOT NULL,
                invoice_no VARCHAR(64) NOT NULL,
                invoice_type VARCHAR(32) NOT NULL DEFAULT 'sales',
                title VARCHAR(300) NOT NULL DEFAULT '',
                customer_id INTEGER REFERENCES biz_customers(id),
                supplier_id INTEGER REFERENCES biz_suppliers(id),
                customer_name VARCHAR(200) DEFAULT '',
                supplier_name VARCHAR(200) DEFAULT '',
                amount NUMERIC(15,2) NOT NULL DEFAULT 0,
                tax_amount NUMERIC(15,2) DEFAULT 0,
                total_amount NUMERIC(15,2) DEFAULT 0,
                invoice_date DATE,
                issue_date DATE,
                due_date DATE,
                status VARCHAR(32) DEFAULT 'draft',
                payment_status VARCHAR(32) DEFAULT 'unpaid',
                invoice_category VARCHAR(64) DEFAULT '',
                tax_rate NUMERIC(5,2) DEFAULT 0,
                remarks TEXT DEFAULT '',
                file_ids JSONB DEFAULT '[]',
                project_id INTEGER REFERENCES biz_projects(id),
                contract_id INTEGER REFERENCES biz_contracts(id),
                created_by INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
            CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_status);
            CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

            -- 单据管理（采购单、销售单、出入库单等）
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id) NOT NULL,
                document_no VARCHAR(64) NOT NULL,
                document_type VARCHAR(32) NOT NULL,
                title VARCHAR(300) NOT NULL DEFAULT '',
                customer_id INTEGER REFERENCES biz_customers(id),
                supplier_id INTEGER REFERENCES biz_suppliers(id),
                customer_name VARCHAR(200) DEFAULT '',
                supplier_name VARCHAR(200) DEFAULT '',
                total_amount NUMERIC(15,2) DEFAULT 0,
                paid_amount NUMERIC(15,2) DEFAULT 0,
                document_date DATE,
                due_date DATE,
                status VARCHAR(32) DEFAULT 'draft',
                items JSONB DEFAULT '[]',
                remarks TEXT DEFAULT '',
                file_ids JSONB DEFAULT '[]',
                project_id INTEGER REFERENCES biz_projects(id),
                contract_id INTEGER REFERENCES biz_contracts(id),
                related_invoice_id INTEGER REFERENCES invoices(id),
                created_by INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
            CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
            CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
            CREATE INDEX IF NOT EXISTS idx_documents_supplier ON documents(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);

            -- 用户实名认证表
            CREATE TABLE IF NOT EXISTS user_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                real_name VARCHAR(20) NOT NULL,
                id_card_number VARCHAR(18) DEFAULT '',
                bank_card_number VARCHAR(19) DEFAULT '',
                status VARCHAR(16) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_user_verifications_user ON user_verifications(user_id);

            -- 外部数据导入记录
            CREATE TABLE IF NOT EXISTS import_records (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                user_id VARCHAR(64) NOT NULL,
                source_type VARCHAR(16) NOT NULL,
                file_type VARCHAR(16) DEFAULT '',
                file_id VARCHAR(64) DEFAULT '',
                total_items INTEGER DEFAULT 0,
                imported_items INTEGER DEFAULT 0,
                skipped_items INTEGER DEFAULT 0,
                status VARCHAR(16) DEFAULT 'processing',
                error_log TEXT DEFAULT '',
                stats JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_import_records_tenant ON import_records(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_import_records_source ON import_records(source_type);

            -- 导入联系人（客户线索池）
            CREATE TABLE IF NOT EXISTS import_contacts (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) REFERENCES tenants(tenant_id),
                import_record_id INTEGER REFERENCES import_records(id) ON DELETE CASCADE,
                name VARCHAR(200) DEFAULT '',
                phone VARCHAR(64) DEFAULT '',
                company VARCHAR(300) DEFAULT '',
                source VARCHAR(16) NOT NULL,
                raw_data JSONB DEFAULT '{}',
                matched_customer_id INTEGER REFERENCES biz_customers(id),
                is_duplicate BOOLEAN DEFAULT FALSE,
                status VARCHAR(16) DEFAULT 'new',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_import_contacts_tenant ON import_contacts(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_import_contacts_phone ON import_contacts(phone);
            CREATE INDEX IF NOT EXISTS idx_import_contacts_record ON import_contacts(import_record_id);

            CREATE TABLE IF NOT EXISTS sms_logs (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) NOT NULL,
                template_id VARCHAR(100) DEFAULT '',
                params JSONB DEFAULT '{}',
                provider VARCHAR(20) DEFAULT 'log',
                success BOOLEAN DEFAULT FALSE,
                message_id VARCHAR(200) DEFAULT '',
                error TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone);
            CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);

            -- 微信公众号绑定
            CREATE TABLE IF NOT EXISTS wechat_mp_bindings (
                id SERIAL PRIMARY KEY,
                openid VARCHAR(64) NOT NULL UNIQUE,
                unionid VARCHAR(64),
                tenant_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                nickname VARCHAR(64) DEFAULT '',
                avatar_url VARCHAR(256) DEFAULT '',
                is_bound BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_wx_mp_bindings_tenant ON wechat_mp_bindings(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_wx_mp_bindings_openid ON wechat_mp_bindings(openid);

            -- 微信公众号原始消息
            CREATE TABLE IF NOT EXISTS wechat_mp_messages (
                id SERIAL PRIMARY KEY,
                msg_id BIGINT NOT NULL,
                openid VARCHAR(64) NOT NULL,
                tenant_id VARCHAR(32) NOT NULL,
                msg_type VARCHAR(16) NOT NULL DEFAULT 'text',
                content TEXT DEFAULT '',
                media_id VARCHAR(128) DEFAULT '',
                pic_url TEXT DEFAULT '',
                from_group VARCHAR(128) DEFAULT '',
                from_group_id VARCHAR(64) DEFAULT '',
                is_stored BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_wx_mp_messages_openid ON wechat_mp_messages(openid);
            CREATE INDEX IF NOT EXISTS idx_wx_mp_messages_tenant ON wechat_mp_messages(tenant_id);

            -- 微信公众号配置（管理后台可编辑）
            CREATE TABLE IF NOT EXISTS wechat_mp_config (
                id SERIAL PRIMARY KEY,
                appid VARCHAR(64) DEFAULT '' NOT NULL,
                appsecret VARCHAR(128) DEFAULT '' NOT NULL,
                token VARCHAR(64) DEFAULT 'lingjing_wechat_mp_token' NOT NULL,
                encoding_aes_key VARCHAR(128) DEFAULT '',
                is_verified BOOLEAN DEFAULT false,
                updated_by VARCHAR(32) DEFAULT '',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            INSERT INTO wechat_mp_config (appid, appsecret, token)
            SELECT '', '', 'lingjing_wechat_mp_token'
            WHERE NOT EXISTS (SELECT 1 FROM wechat_mp_config);

            -- 企业微信配置
            CREATE TABLE IF NOT EXISTS wecom_config (
                id              SERIAL PRIMARY KEY,
                corp_id         VARCHAR(64) NOT NULL DEFAULT '',
                agent_id        INTEGER NOT NULL DEFAULT 0,
                agent_secret    VARCHAR(128) NOT NULL DEFAULT '',
                token           VARCHAR(64) NOT NULL DEFAULT '',
                encoding_aes_key VARCHAR(128) NOT NULL DEFAULT '',
                callback_url    VARCHAR(256) DEFAULT '',
                callback_enabled BOOLEAN DEFAULT FALSE,
                tenant_id       VARCHAR(32) DEFAULT '',
                updated_by      VARCHAR(32) DEFAULT '',
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            );

            -- 企业微信成员映射表
            CREATE TABLE IF NOT EXISTS wecom_corp_users (
                id              SERIAL PRIMARY KEY,
                userid          VARCHAR(64) NOT NULL UNIQUE,
                name            VARCHAR(64) DEFAULT '',
                department      INTEGER[],
                mobile          VARCHAR(32) DEFAULT '',
                avatar          VARCHAR(256) DEFAULT '',
                status          INTEGER DEFAULT 1,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            );
        """)

@asynccontextmanager
async def get_conn():
    """获取数据库连接"""
    async with pool.acquire() as conn:
        yield conn

async def fetchone(sql: str, *args) -> Optional[Dict]:
    """查询单条"""
    async with get_conn() as conn:
        return await conn.fetchrow(sql, *args)

async def fetchall(sql: str, *args) -> List[Dict]:
    """查询多条"""
    async with get_conn() as conn:
        return await conn.fetch(sql, *args)

async def execute(sql: str, *args) -> str:
    """执行SQL"""
    async with get_conn() as conn:
        return await conn.execute(sql, *args)

async def insert(sql: str, *args) -> str:
    """插入并返回ID"""
    async with get_conn() as conn:
        row = await conn.fetchrow(sql, *args)
        return str(row[0]) if row else None
