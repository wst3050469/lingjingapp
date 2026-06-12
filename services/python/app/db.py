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

async def migrate_existing_tables():
    """迁移已有表结构：为已存在的表添加缺失列（幂等）"""
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        for col, typ in [
            ("attachments", "JSONB DEFAULT '[]'"),
            ("tokens_input", "INTEGER DEFAULT 0"),
            ("tokens_output", "INTEGER DEFAULT 0"),
            ("cost_yuan", "DECIMAL(10,6) DEFAULT 0"),
            ("model_used", "VARCHAR(64) DEFAULT ''"),
            ("context_memories", "JSONB DEFAULT '[]'"),
        ]:
            await conn.execute(
                f"ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS {col} {typ}"
            )
            logger.info(f"迁移: chat_messages.{col} 已确保存在")
        await conn.close()
        return True
    except Exception as e:
        logger.warning(f"迁移跳过 (表可能尚不存在): {e}")
        return False

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
    await migrate_existing_tables()
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
            -- 租户表（引用基础表，被 departments/projects/tasks 等大量表引用）
            CREATE TABLE IF NOT EXISTS tenants (
                tenant_id VARCHAR(32) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                company_name VARCHAR(200) DEFAULT '',
                domain VARCHAR(200) DEFAULT '',
                logo_url VARCHAR(500) DEFAULT '',
                settings JSONB DEFAULT '{}'::jsonb,
                config JSONB DEFAULT '{}'::jsonb,
                plan VARCHAR(50) DEFAULT 'basic',
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_logs' AND column_name='created_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_logs' AND column_name='admin_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_logs' AND column_name='action') THEN
                    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
                END IF;
            END
            $$;

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

            -- 待办事项（被 todo_service, auto_fetch_service, biz_actions 等大量引用）
            CREATE TABLE IF NOT EXISTS todo_items (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) DEFAULT '',
                type VARCHAR(64) DEFAULT 'custom',
                title TEXT DEFAULT '',
                detail TEXT DEFAULT '',
                ref_type VARCHAR(64) DEFAULT '',
                ref_id VARCHAR(64) DEFAULT '',
                priority INTEGER DEFAULT 50,
                status VARCHAR(20) DEFAULT 'pending',
                last_synced_at TIMESTAMPTZ,
                done_at TIMESTAMPTZ,
                done_by VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_todo_items_tenant ON todo_items(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_todo_items_status ON todo_items(status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_todo_items_user ON todo_items(user_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='ref_type') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='ref_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_todo_items_ref ON todo_items(ref_type, ref_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todo_items' AND column_name='last_synced_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_todo_items_last_synced ON todo_items(last_synced_at);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_tasks' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_auto_tasks_tenant ON automated_tasks(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_tasks' AND column_name='is_enabled') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_tasks' AND column_name='next_run_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_auto_tasks_next_run ON automated_tasks(is_enabled, next_run_at);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_task_logs' AND column_name='task_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_task_logs' AND column_name='executed_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_auto_logs_task ON automated_task_logs(task_id, executed_at DESC);
                END IF;
            END
            $$;

            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='project_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assignee_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approvals' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recipes' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON recipes(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recipes' AND column_name='category') THEN
                    CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='template_images' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_template_images_tenant ON template_images(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='template_images' AND column_name='category') THEN
                    CREATE INDEX IF NOT EXISTS idx_template_images_category ON template_images(category);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='target_user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(target_user_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='target_user_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
                    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(target_user_id, is_read);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='event_type') THEN
                    CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, event_type);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='customer_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='supplier_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_status') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_date') THEN
                    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='document_type') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='customer_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='supplier_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_supplier ON documents(supplier_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='document_date') THEN
                    CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_verifications' AND column_name='user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_user_verifications_user ON user_verifications(user_id);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_records' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_import_records_tenant ON import_records(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_records' AND column_name='source_type') THEN
                    CREATE INDEX IF NOT EXISTS idx_import_records_source ON import_records(source_type);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_contacts' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_import_contacts_tenant ON import_contacts(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_contacts' AND column_name='phone') THEN
                    CREATE INDEX IF NOT EXISTS idx_import_contacts_phone ON import_contacts(phone);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='import_contacts' AND column_name='import_record_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_import_contacts_record ON import_contacts(import_record_id);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sms_logs' AND column_name='phone') THEN
                    CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sms_logs' AND column_name='created_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wechat_mp_bindings' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_wx_mp_bindings_tenant ON wechat_mp_bindings(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wechat_mp_bindings' AND column_name='openid') THEN
                    CREATE INDEX IF NOT EXISTS idx_wx_mp_bindings_openid ON wechat_mp_bindings(openid);
                END IF;
            END
            $$;

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
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wechat_mp_messages' AND column_name='openid') THEN
                    CREATE INDEX IF NOT EXISTS idx_wx_mp_messages_openid ON wechat_mp_messages(openid);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wechat_mp_messages' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_wx_mp_messages_tenant ON wechat_mp_messages(tenant_id);
                END IF;
            END
            $$;

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

            -- 租户用户映射表（被 notification_service, push_service, biz_query 等大量引用）
            CREATE TABLE IF NOT EXISTS tenant_users (
                id              SERIAL PRIMARY KEY,
                user_id         VARCHAR(255) NOT NULL,
                tenant_id       VARCHAR(255) NOT NULL,
                name            VARCHAR(255) DEFAULT '',
                role            VARCHAR(50) DEFAULT 'member',
                status          VARCHAR(20) DEFAULT 'active',
                ext_data        JSONB DEFAULT '{}'::jsonb,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, tenant_id)
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_users' AND column_name='user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_users' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_users' AND column_name='role') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);
                END IF;
            END
            $$;

            -- 租户级通知表
            CREATE TABLE IF NOT EXISTS tenant_notifications (
                id               SERIAL PRIMARY KEY,
                tenant_id        VARCHAR(255) NOT NULL,
                title            TEXT DEFAULT '',
                content          TEXT DEFAULT '',
                notification_type VARCHAR(50) DEFAULT 'info',
                priority         INTEGER DEFAULT 0,
                status           VARCHAR(20) DEFAULT 'pending',
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                updated_at       TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_notifications' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_notifications_tenant ON tenant_notifications(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_notifications' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_notifications_status ON tenant_notifications(status);
                END IF;
            END
            $$;

            -- 平台管理
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(64) NOT NULL UNIQUE,
                password_hash VARCHAR(128) NOT NULL,
                nickname VARCHAR(64) DEFAULT '',
                role VARCHAR(20) DEFAULT 'admin',
                token VARCHAR(256) DEFAULT '',
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                api_key VARCHAR(128) NOT NULL UNIQUE,
                name VARCHAR(100) DEFAULT '',
                description TEXT DEFAULT '',
                tenant_id VARCHAR(64) DEFAULT '',
                status VARCHAR(20) DEFAULT 'active',
                created_by VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS app_versions (
                id SERIAL PRIMARY KEY,
                version_code INTEGER NOT NULL,
                version_name VARCHAR(50) NOT NULL,
                platform VARCHAR(20) DEFAULT 'all',
                file_url VARCHAR(500) DEFAULT '',
                file_size BIGINT DEFAULT 0,
                file_sha512 VARCHAR(128) DEFAULT '',
                apk_filename VARCHAR(200) DEFAULT '',
                apk_size BIGINT DEFAULT 0,
                is_force_update BOOLEAN DEFAULT FALSE,
                uploaded_by VARCHAR(64) DEFAULT '',
                release_notes TEXT DEFAULT '',
                status VARCHAR(20) DEFAULT 'published',
                download_count INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- 兼容旧表：补充缺失字段（CREATE TABLE IF NOT EXISTS 不会修改已有表）
            ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_filename VARCHAR(200) DEFAULT '';
            ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_size BIGINT DEFAULT 0;
            ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS is_force_update BOOLEAN DEFAULT FALSE;
            ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(64) DEFAULT '';

            CREATE TABLE IF NOT EXISTS platform_feedback (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(64) DEFAULT '',
                type VARCHAR(32) DEFAULT 'feedback',
                content TEXT DEFAULT '',
                status VARCHAR(20) DEFAULT 'pending',
                response TEXT DEFAULT '',
                responded_by VARCHAR(64) DEFAULT '',
                responded_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS webhook_events (
                id SERIAL PRIMARY KEY,
                event_id VARCHAR(64) NOT NULL UNIQUE,
                tenant_id VARCHAR(64) DEFAULT '',
                event_type VARCHAR(64) NOT NULL,
                source VARCHAR(64) DEFAULT '',
                payload JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'pending',
                processed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS servers (
                server_id VARCHAR(64) PRIMARY KEY,
                name VARCHAR(100) DEFAULT '',
                host VARCHAR(255) DEFAULT '',
                port INTEGER DEFAULT 0,
                type VARCHAR(32) DEFAULT 'api',
                status VARCHAR(20) DEFAULT 'active',
                config JSONB DEFAULT '{}',
                last_heartbeat TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 业务管理
            CREATE TABLE IF NOT EXISTS biz_finance (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                ext_id VARCHAR(64) DEFAULT '',
                type VARCHAR(32) DEFAULT 'expense',
                category VARCHAR(64) DEFAULT '',
                amount NUMERIC(15,2) DEFAULT 0,
                applicant_name VARCHAR(100) DEFAULT '',
                status VARCHAR(20) DEFAULT 'pending',
                reason TEXT DEFAULT '',
                approved_by VARCHAR(64) DEFAULT '',
                approved_at TIMESTAMPTZ,
                supplier_name VARCHAR(200) DEFAULT '',
                material_desc TEXT DEFAULT '',
                expense_date DATE,
                file_ids JSONB DEFAULT '[]',
                last_synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_finance' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_finance_tenant ON biz_finance(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_finance' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_finance_status ON biz_finance(status);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_finance' AND column_name='project_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_finance_project ON biz_finance(project_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS biz_attendance (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) DEFAULT '',
                user_name VARCHAR(100) DEFAULT '',
                project_id INTEGER REFERENCES biz_projects(id),
                check_in TIMESTAMPTZ,
                check_out TIMESTAMPTZ,
                latitude FLOAT DEFAULT 0,
                longitude FLOAT DEFAULT 0,
                address VARCHAR(500) DEFAULT '',
                status VARCHAR(20) DEFAULT 'present',
                source VARCHAR(32) DEFAULT 'manual',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_attendance' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_attendance_tenant ON biz_attendance(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_attendance' AND column_name='user_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_attendance_user ON biz_attendance(user_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS biz_quality_inspections (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                inspection_type VARCHAR(64) DEFAULT '',
                result VARCHAR(64) DEFAULT '',
                inspector_name VARCHAR(100) DEFAULT '',
                inspection_date DATE,
                description TEXT DEFAULT '',
                score INTEGER DEFAULT 0,
                file_ids JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_quality_inspections' AND column_name='project_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_quality_project ON biz_quality_inspections(project_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS biz_processes (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                ext_id VARCHAR(64) DEFAULT '',
                name VARCHAR(200) DEFAULT '',
                stage VARCHAR(64) DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                progress FLOAT DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                responsible_name VARCHAR(100) DEFAULT '',
                planned_start DATE, planned_end DATE,
                actual_start TIMESTAMPTZ, actual_end TIMESTAMPTZ,
                remarks TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_processes' AND column_name='project_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_biz_processes_project ON biz_processes(project_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS sample_records (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                customer_name VARCHAR(200) DEFAULT '',
                recipe_name VARCHAR(200) DEFAULT '',
                specs JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'pending',
                created_by VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS biz_supplier_products (
                id SERIAL PRIMARY KEY,
                supplier_id INTEGER REFERENCES biz_suppliers(id),
                product_name VARCHAR(200) DEFAULT '',
                spec VARCHAR(200) DEFAULT '',
                unit VARCHAR(32) DEFAULT '',
                unit_price NUMERIC(15,2) DEFAULT 0,
                quoted_at DATE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- AI 智能模块
            CREATE TABLE IF NOT EXISTS ai_alerts (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                alert_type VARCHAR(64) DEFAULT '',
                severity VARCHAR(32) DEFAULT 'info',
                title VARCHAR(300) DEFAULT '',
                detail TEXT DEFAULT '',
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_alerts' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_ai_alerts_tenant ON ai_alerts(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_alerts' AND column_name='status') THEN
                    CREATE INDEX IF NOT EXISTS idx_ai_alerts_status ON ai_alerts(status);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS ai_approvals (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                project_id INTEGER REFERENCES biz_projects(id),
                approval_type VARCHAR(64) DEFAULT '',
                title VARCHAR(300) DEFAULT '',
                detail TEXT DEFAULT '',
                applicant VARCHAR(100) DEFAULT '',
                amount NUMERIC(15,2) DEFAULT 0,
                result VARCHAR(32) DEFAULT 'pending_review',
                reviewed_by VARCHAR(100) DEFAULT '',
                reviewed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_approvals' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_ai_approvals_tenant ON ai_approvals(tenant_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS ai_construction_rules (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                name VARCHAR(200) DEFAULT '',
                description TEXT DEFAULT '',
                rule_type VARCHAR(64) DEFAULT '',
                conditions JSONB DEFAULT '{}',
                actions JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                priority INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_construction_rules' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_ai_rules_tenant ON ai_construction_rules(tenant_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS ai_daily_reports (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                report_date DATE,
                summary TEXT DEFAULT '',
                data JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_daily_reports' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_ai_reports_tenant ON ai_daily_reports(tenant_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS ai_partners (
                id SERIAL PRIMARY KEY,
                partner_id VARCHAR(64) NOT NULL UNIQUE,
                tenant_id VARCHAR(64) DEFAULT '',
                name VARCHAR(200) DEFAULT '',
                partner_type VARCHAR(64) DEFAULT '',
                api_endpoint VARCHAR(500) DEFAULT '',
                api_key VARCHAR(256) DEFAULT '',
                config JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'active',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 客户/供应商跟进
            CREATE TABLE IF NOT EXISTS customer_followups (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                customer_id INTEGER REFERENCES biz_customers(id),
                type VARCHAR(32) DEFAULT 'visit',
                content TEXT DEFAULT '',
                created_by VARCHAR(64) DEFAULT '',
                session_id VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_followups' AND column_name='customer_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_customer_followups_customer ON customer_followups(customer_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS supplier_followups (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) NOT NULL,
                supplier_id INTEGER REFERENCES biz_suppliers(id),
                supplier_name VARCHAR(200) DEFAULT '',
                type VARCHAR(32) DEFAULT 'visit',
                content TEXT DEFAULT '',
                created_by VARCHAR(64) DEFAULT '',
                session_id VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_followups' AND column_name='supplier_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_supplier_followups_supplier ON supplier_followups(supplier_id);
                END IF;
            END
            $$;

            -- 聊天 & 记忆
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id VARCHAR(64) PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT '',
                user_id VARCHAR(64) DEFAULT '',
                title VARCHAR(200) DEFAULT '',
                model VARCHAR(64) DEFAULT '',
                context JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(64) REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
                role VARCHAR(16) NOT NULL,
                content TEXT DEFAULT '',
                attachments JSONB DEFAULT '[]',
                tokens_input INTEGER DEFAULT 0,
                tokens_output INTEGER DEFAULT 0,
                cost_yuan DECIMAL(10,6) DEFAULT 0,
                model_used VARCHAR(64) DEFAULT '',
                context_memories JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='session_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
                END IF;
            END
            $$;
            -- Migration: ensure all columns exist for existing tables
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0;
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0;
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS cost_yuan DECIMAL(10,6) DEFAULT 0;
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS model_used VARCHAR(64) DEFAULT '';
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS context_memories JSONB DEFAULT '[]';

            CREATE TABLE IF NOT EXISTS memories (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT '',
                user_id VARCHAR(64) DEFAULT '',
                source_type VARCHAR(64) DEFAULT 'manual',
                source_table VARCHAR(64) DEFAULT '',
                source_id VARCHAR(64) DEFAULT '',
                content TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                tags TEXT[] DEFAULT '{}',
                importance INTEGER DEFAULT 50,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='memories' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_memories_tenant ON memories(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='memories' AND column_name='source_table') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='memories' AND column_name='source_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source_table, source_id);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS entity_facts (
                id SERIAL PRIMARY KEY,
                source_user VARCHAR(64) DEFAULT '',
                entity_name VARCHAR(200) NOT NULL,
                field_name VARCHAR(200) NOT NULL,
                field_value TEXT DEFAULT '',
                confidence FLOAT DEFAULT 1.0,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(entity_name, field_name)
            );
            CREATE TABLE IF NOT EXISTS message_files (
                file_id VARCHAR(64) PRIMARY KEY,
                stored_path VARCHAR(500) DEFAULT '',
                file_type VARCHAR(32) DEFAULT '',
                original_name VARCHAR(200) DEFAULT '',
                file_size BIGINT DEFAULT 0,
                message_id VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 推送 & 成本 & 报表
            CREATE TABLE IF NOT EXISTS user_push_tokens (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                push_token VARCHAR(256) NOT NULL,
                platform VARCHAR(32) DEFAULT 'unknown',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, push_token)
            );
            CREATE TABLE IF NOT EXISTS cost_tracking (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT '',
                session_id VARCHAR(64) DEFAULT '',
                model VARCHAR(64) DEFAULT '',
                cost_yuan NUMERIC(15,6) DEFAULT 0,
                tokens_input INTEGER DEFAULT 0,
                tokens_output INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_tracking' AND column_name='created_at') THEN
                    CREATE INDEX IF NOT EXISTS idx_cost_tracking_created ON cost_tracking(created_at);
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS personal_reports (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(64) DEFAULT '',
                tenant_id VARCHAR(64) DEFAULT '',
                period_start DATE, period_end DATE,
                report_type VARCHAR(32) DEFAULT 'weekly',
                content TEXT DEFAULT '', summary TEXT DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS consensus_ledger (
                id SERIAL PRIMARY KEY,
                hash VARCHAR(64) NOT NULL,
                previous_hash VARCHAR(64) DEFAULT '',
                event_type VARCHAR(64) DEFAULT '',
                payload JSONB DEFAULT '{}',
                created_by VARCHAR(64) DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 通话 & 微信
            CREATE TABLE IF NOT EXISTS call_analyses (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT '',
                session_id VARCHAR(64) DEFAULT '',
                transcript_status VARCHAR(32) DEFAULT 'pending',
                transcript_text TEXT DEFAULT '',
                analysis JSONB DEFAULT '{}',
                recording_url VARCHAR(500) DEFAULT '',
                duration_seconds INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS wechat_analysis (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT '',
                group_id VARCHAR(64) DEFAULT '',
                period_start DATE, period_end DATE,
                total_messages INTEGER DEFAULT 0,
                active_members INTEGER DEFAULT 0,
                summary TEXT DEFAULT '',
                details JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS wechat_groups (
                id SERIAL PRIMARY KEY,
                group_id VARCHAR(64) NOT NULL UNIQUE,
                tenant_id VARCHAR(64) DEFAULT '',
                name VARCHAR(200) DEFAULT '',
                member_count INTEGER DEFAULT 0,
                total_messages INTEGER DEFAULT 0,
                source VARCHAR(32) DEFAULT 'manual',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS wechat_messages (
                id SERIAL PRIMARY KEY,
                group_id VARCHAR(64) REFERENCES wechat_groups(group_id),
                msg_id VARCHAR(64) DEFAULT '',
                sender_name VARCHAR(100) DEFAULT '',
                content TEXT DEFAULT '',
                msg_type VARCHAR(32) DEFAULT 'text',
                sent_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wechat_messages' AND column_name='group_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_wechat_messages_group ON wechat_messages(group_id);
                END IF;
            END
            $$;

            -- 租户邀请码
            CREATE TABLE IF NOT EXISTS tenant_invite_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                tenant_id VARCHAR(64) NOT NULL,
                nickname VARCHAR(100) DEFAULT '',
                role VARCHAR(32) DEFAULT 'member',
                status VARCHAR(20) DEFAULT 'active',
                created_by VARCHAR(64) DEFAULT '',
                used_by VARCHAR(64) DEFAULT '',
                used_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_invite_codes' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_invite_codes_tenant ON tenant_invite_codes(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_invite_codes' AND column_name='code') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_invite_codes_code ON tenant_invite_codes(code);
                END IF;
            END
            $$;

            -- 租户资源配额用量追踪
            CREATE TABLE IF NOT EXISTS tenant_usage (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id),
                resource VARCHAR(32) NOT NULL,
                used_count INTEGER DEFAULT 0,
                reset_date DATE DEFAULT CURRENT_DATE,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tenant_id, resource, reset_date)
            );
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_usage' AND column_name='tenant_id') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
                END IF;
            END
            $$;
            -- Safe index: only create if referenced columns exist
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_usage' AND column_name='tenant_id') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_usage' AND column_name='resource') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_usage' AND column_name='reset_date') THEN
                    CREATE INDEX IF NOT EXISTS idx_tenant_usage_reset ON tenant_usage(tenant_id, resource, reset_date);
                END IF;
            END
            $$;
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
