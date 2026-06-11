"""灵境平台 - 认证路由（邀请码 + 用户名密码 + 企业注册）"""
import re
import uuid
import secrets
import json
import asyncio
import bcrypt
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from services.industry_config import INDUSTRIES, get_industry_config
from routers.admin import log_admin_action

logger = logging.getLogger("lingjing.auth")

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,20}$')


class VerifyRequest(BaseModel):
    code: str
    nickname: str = ""


class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    account_type: str = "personal"  # personal 或 enterprise


class LoginRequest(BaseModel):
    username: str
    password: str


class EnterpriseRegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    company_name: str
    industry: str
    owner_name: str = ""
    owner_phone: str = ""


class JoinTeamRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    invite_code: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class FeedbackRequest(BaseModel):
    content: str
    type: str = "feedback"  # feedback 或 feature_request


class IdentityVerificationRequest(BaseModel):
    real_name: str
    id_card_number: str = ""
    bank_card_number: str = ""


async def get_current_user(authorization: str = Header(None)) -> dict:
    """从 token 获取当前用户信息（双表查找：invite_codes → users）
    返回: {code, nickname, tenant_id?, tenant_role?, company_name?, owner_name?, industry?}
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")
    token = authorization[7:]
    async with database.pool.acquire() as conn:
        # 先查邀请码表（邀请码用户无租户，纯个人聊天）
        row = await conn.fetchrow(
            "SELECT code, nickname, status FROM invite_codes WHERE token=$1 AND status='active'",
            token,
        )
        if row:
            return {
                "code": row["code"],
                "nickname": row["nickname"],
                "user_id": None,
                "tenant_id": None,
                "tenant_role": None,
                "company_name": None,
                "owner_name": None,
                "industry": None,
            }
        # 再查用户表（带租户信息）
        row = await conn.fetchrow(
            """SELECT u.id, u.username, u.nickname, u.status, u.tenant_id,
                      u.token_expires_at,
                      t.company_name, t.owner_name, t.industry,
                      tu.role AS tenant_role
               FROM users u
               LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
               LEFT JOIN tenant_users tu ON tu.tenant_id = u.tenant_id
                    AND tu.user_id = u.username
               WHERE u.token=$1 AND u.status='active'""",
            token,
        )
        if row:
            # 检查token是否过期
            expires_at = row["token_expires_at"]
            if expires_at is not None and expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Token已过期，请重新登录")
            return {
                "code": "u_" + row["username"],
                "nickname": row["nickname"],
                "user_id": row["id"],
                "tenant_id": row["tenant_id"],
                "tenant_role": row["tenant_role"],
                "company_name": row["company_name"],
                "owner_name": row["owner_name"],
                "industry": row["industry"],
            }
    raise HTTPException(status_code=401, detail="无效或已失效的访问令牌")


@router.post("/register")
async def register(req: RegisterRequest):
    username = req.username.strip()
    password = req.password
    nickname = req.nickname.strip() or username
    account_type = req.account_type.strip()

    if account_type not in ("personal", "enterprise"):
        raise HTTPException(status_code=422, detail="账号类型只能是 personal 或 enterprise")
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=422, detail="用户名需要3-20个字符，仅支持字母数字和下划线")
    if len(password) < 6 or len(password) > 128:
        raise HTTPException(status_code=422, detail="密码需要6-128个字符")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    token = secrets.token_urlsafe(48)

    async with database.pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchval(
                "SELECT id FROM users WHERE username=$1", username,
            )
            if existing:
                raise HTTPException(status_code=409, detail="用户名已被注册")
            await conn.execute(
                """INSERT INTO users (username, password_hash, nickname, token, account_type, token_expires_at, last_login_at)
                   VALUES ($1, $2, $3, $4, $5, NOW() + interval '7 days', NOW())""",
                username, password_hash, nickname, token, account_type,
            )
    return {
        "code": 0,
        "token": token,
        "nickname": nickname,
        "account_type": account_type,
        "need_verification": True,
        "msg": "注册成功，欢迎进入灵境",
    }


@router.post("/login")
async def login(req: LoginRequest):
    username = req.username.strip()
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT u.id, u.password_hash, u.nickname, u.token, u.status,
                      u.tenant_id, u.account_type, t.company_name, t.industry,
                      tu.role AS tenant_role
               FROM users u
               LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
               LEFT JOIN tenant_users tu ON tu.tenant_id = u.tenant_id AND tu.user_id = u.username
               WHERE u.username=$1""",
            username,
        )
    if not row:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if row["status"] == "pending":
        raise HTTPException(status_code=403, detail="该账号正在审核中，请耐心等待")
    if row["status"] == "disabled":
        raise HTTPException(status_code=403, detail="该账号已被禁用")
    if not bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = row["token"]
    if not token:
        token = secrets.token_urlsafe(48)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET token=$1, token_expires_at=NOW() + interval '7 days', last_login_at=NOW() WHERE id=$2",
            token, row["id"],
        )
        # 检查是否已完成实名认证
        ver = await conn.fetchrow(
            "SELECT status FROM user_verifications WHERE user_id=$1", row["id"],
        )
    need_verification = ver is None  # 仅从未提交过才需认证
    result = {
        "code": 0,
        "token": token,
        "nickname": row["nickname"],
        "account_type": row["account_type"] or "personal",
        "need_verification": need_verification,
        "msg": "欢迎回来",
    }
    if row["tenant_id"]:
        result["tenant_id"] = row["tenant_id"]
        result["company_name"] = row["company_name"]
        result["industry"] = row["industry"]
        result["tenant_role"] = row["tenant_role"]
    return result


@router.post("/verify")
async def verify_invite_code(req: VerifyRequest):
    code = req.code.strip()
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT code, nickname, status, token FROM invite_codes WHERE code=$1",
            code,
        )
    if not row:
        # 检查是否是团队邀请码
        async with database.pool.acquire() as conn:
            team_row = await conn.fetchrow(
                "SELECT code, status, tenant_id FROM tenant_invite_codes WHERE code=$1",
                code.upper(),
            )
        if team_row:
            company = team_row['tenant_id']
            try:
                async with database.pool.acquire() as conn:
                    t = await conn.fetchrow(
                        "SELECT company_name FROM tenants WHERE tenant_id=$1",
                        team_row['tenant_id'],
                    )
                    if t:
                        company = t['company_name']
            except Exception as e:
                import logging
                logging.getLogger("lingjing.auth").warning(f"查询租户公司名失败: {e}")
                pass
            raise HTTPException(
                status_code=400,
                detail=f"这是「{company}」的团队邀请码，请点击注册页面，填写邀请码加入团队",
            )
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if row["status"] == "disabled":
        raise HTTPException(status_code=403, detail="该邀请码已被禁用")

    # 每次验证都重新生成 token（防止已泄露的邀请码被重复使用）
    token = secrets.token_urlsafe(48)
    nickname = req.nickname.strip() or row["nickname"] or "匿名用户"
    async with database.pool.acquire() as conn:
        await conn.execute(
            """UPDATE invite_codes
               SET status='active', token=$1, nickname=$2, activated_at=NOW()
               WHERE code=$3""",
            token, nickname, code,
        )
    return {
        "code": 0,
        "token": token,
        "nickname": nickname,
        "msg": "欢迎进入灵境",
    }


@router.get("/industries")
async def list_industries():
    """获取可选行业列表（公开接口，无需认证）"""
    return {
        "code": 0,
        "data": [
            {"code": i["code"], "name": i["name"], "description": i["description"]}
            for i in INDUSTRIES
        ],
    }


@router.post("/register-enterprise")
async def register_enterprise(req: EnterpriseRegisterRequest):
    """企业注册：创建租户 + 用户 + 角色（一个事务）"""
    username = req.username.strip()
    password = req.password
    nickname = req.nickname.strip() or username
    company_name = req.company_name.strip()
    industry = req.industry.strip()
    owner_name = req.owner_name.strip() or nickname
    owner_phone = req.owner_phone.strip()

    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=422, detail="用户名需要3-20个字符，仅支持字母数字和下划线")
    if len(password) < 6 or len(password) > 128:
        raise HTTPException(status_code=422, detail="密码需要6-128个字符")
    if len(company_name) < 2 or len(company_name) > 50:
        raise HTTPException(status_code=422, detail="公司名称需要2-50个字符")
    if not get_industry_config(industry):
        raise HTTPException(status_code=422, detail="不支持的行业类型")

    tenant_id = f"t_{uuid.uuid4().hex[:12]}"
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    token = secrets.token_urlsafe(48)

    async with database.pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM users WHERE username=$1", username,
        )
        if existing:
            raise HTTPException(status_code=409, detail="用户名已被注册")

        async with conn.transaction():
            await conn.execute(
                """INSERT INTO tenants
                   (tenant_id, company_name, industry, owner_name, owner_phone, plan, status)
                   VALUES ($1, $2, $3, $4, $5, 'trial', 'active')""",
                tenant_id, company_name, industry, owner_name, owner_phone,
            )
            await conn.execute(
                """INSERT INTO users
                   (username, password_hash, nickname, token, tenant_id, account_type, last_login_at, status)
                   VALUES ($1, $2, $3, $4, $5, 'enterprise', NOW(), 'active')""",
                username, password_hash, nickname, token, tenant_id,
            )
            await conn.execute(
                """INSERT INTO tenant_users (tenant_id, user_id, name, role)
                   VALUES ($1, $2, $3, 'owner')""",
                tenant_id, username, nickname,
            )

    return {
        "code": 0,
        "token": token,
        "nickname": nickname,
        "tenant_id": tenant_id,
        "company_name": company_name,
        "industry": industry,
        "account_type": "enterprise",
        "msg": f"企业「{company_name}」注册成功，欢迎使用灵境AI业务管家！",
    }


@router.post("/join-team")
async def join_team(req: JoinTeamRequest):
    """通过团队邀请码注册并加入企业"""
    username = req.username.strip()
    password = req.password
    nickname = req.nickname.strip() or username
    invite_code = req.invite_code.strip().upper()

    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=422, detail="用户名需要3-20个字符，仅支持字母数字和下划线")
    if len(password) < 6 or len(password) > 128:
        raise HTTPException(status_code=422, detail="密码需要6-128个字符")

    async with database.pool.acquire() as conn:
        invite = await conn.fetchrow(
            """SELECT tic.tenant_id, tic.target_role, tic.max_uses, tic.used_count,
                      tic.status, tic.expires_at, t.company_name, t.industry
               FROM tenant_invite_codes tic
               JOIN tenants t ON t.tenant_id = tic.tenant_id
               WHERE tic.code=$1""",
            invite_code,
        )
        if not invite:
            raise HTTPException(status_code=404, detail="邀请码不存在")
        if invite["status"] != "active":
            raise HTTPException(status_code=403, detail="邀请码已失效")
        if invite["expires_at"]:
            from datetime import datetime, timezone
            if invite["expires_at"].astimezone(timezone.utc) < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="邀请码已过期")
        if invite["used_count"] >= invite["max_uses"]:
            raise HTTPException(status_code=403, detail="邀请码已达使用上限")

        existing = await conn.fetchval("SELECT id FROM users WHERE username=$1", username)
        if existing:
            raise HTTPException(status_code=409, detail="用户名已被注册")

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        token = secrets.token_urlsafe(48)
        tenant_id = invite["tenant_id"]
        # 新成员强制为 member，角色由管理员通过AI对话分配
        target_role = "member"

        async with conn.transaction():
            await conn.execute(
                """INSERT INTO users
                   (username, password_hash, nickname, token, tenant_id, account_type, last_login_at)
                   VALUES ($1, $2, $3, $4, $5, 'enterprise', NOW())""",
                username, password_hash, nickname, token, tenant_id,
            )
            await conn.execute(
                """INSERT INTO tenant_users (tenant_id, user_id, name, role)
                   VALUES ($1, $2, $3, $4)""",
                tenant_id, username, nickname, target_role,
            )
            await conn.execute(
                """UPDATE tenant_invite_codes 
                   SET used_count = used_count + 1,
                       used_by = COALESCE(used_by, '[]'::jsonb) || $2::jsonb
                   WHERE code=$1""",
                invite_code, json.dumps([{"username": username, "nickname": nickname, "joined_at": datetime.now(timezone.utc).isoformat()}], ensure_ascii=False),
            )
            # 通知管理员有新成员加入
            await conn.execute(
                """INSERT INTO tenant_notifications
                   (tenant_id, type, target_user_id, target_user_name)
                   VALUES ($1, 'new_member', $2, $3)""",
                tenant_id, username, nickname,
            )

    # 异步推送通知给租户管理员（两套系统桥接）
    asyncio.create_task(_notify_admins_new_member(tenant_id, nickname))
    # 同步写入统一通知表 (notifications)，使待办中心可见
    try:
        from services.notification_service import notify
        await notify(
            tenant_id=tenant_id,
            event_type="member_added",
            title="🎉 新成员加入",
            body=f"""{nickname} 通过邀请码加入了团队，待分配角色""",
            ref_type="tenant_user",
            ref_id=username,
            extras={"new_user_id": username, "new_user_name": nickname},
            priority=80,
        )
    except Exception as e:
        logger.warning(f"成员加入通知写入失败: {e}")

    return {
        "code": 0,
        "token": token,
        "nickname": nickname,
        "tenant_id": tenant_id,
        "company_name": invite["company_name"],
        "industry": invite["industry"],
        "account_type": "enterprise",
        "tenant_role": target_role,
        "msg": f"已加入「{invite['company_name']}」团队",
    }


async def _notify_admins_new_member(tenant_id: str, new_member_name: str):
    """异步推送通知：新成员加入团队"""
    try:
        from services.push_service import push_to_tenant_admins
        await push_to_tenant_admins(
            tenant_id,
            title="🎉 新成员加入",
            content=f"{new_member_name} 已通过邀请码加入团队",
            extras={"type": "new_member", "tenant_id": tenant_id},
        )
    except Exception:
        logger.warning("新成员加入推送失败", exc_info=True)
        pass  # 推送失败不影响主流程


# ── 平台管理员认证 ──────────────────────────────────────

async def get_admin_user(authorization: str = Header(None)) -> dict:
    """验证平台管理员 token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的管理员认证信息")
    token = authorization[7:]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, username, nickname, role, status
               FROM admin_users WHERE token=$1 AND status='active'""",
            token,
        )
        if not row:
            raise HTTPException(status_code=401, detail="无效或已失效的管理员令牌")
        return {
            "admin_id": row["id"],
            "username": row["username"],
            "nickname": row["nickname"],
            "role": row["role"],
        }


@router.post("/admin-login")
async def admin_login(req: AdminLoginRequest):
    """平台管理员登录"""
    username = req.username.strip()
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash, nickname, role, status FROM admin_users WHERE username=$1",
            username,
        )
    if not row:
        raise HTTPException(status_code=401, detail="管理员账号或密码错误")
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="该管理员账号已被禁用")
    if not bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="管理员账号或密码错误")

    token = secrets.token_urlsafe(48)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE admin_users SET token=$1, last_login_at=NOW() WHERE id=$2",
            token, row["id"],
        )
        await log_admin_action(
            {"id": row["id"], "nickname": row["nickname"]},
            "管理员登录", "admin_user", str(row["id"]), "",
            conn,
        )
    return {
        "code": 0,
        "token": token,
        "nickname": row["nickname"],
        "role": row["role"],
        "msg": "管理员登录成功",
    }


@router.get("/admin-check")
async def admin_check(admin: dict = Depends(get_admin_user)):
    """验证管理员 token 是否有效"""
    return {
        "code": 0,
        "nickname": admin["nickname"],
        "role": admin["role"],
        "msg": "管理员会话有效",
    }


# ── 用户端：需求/反馈提交 ──────────────────────────────

@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest, user: dict = Depends(get_current_user)):
    """用户通过灵境提交功能需求或反馈"""
    content = req.content.strip()
    if len(content) < 4:
        raise HTTPException(status_code=422, detail="内容太短，至少4个字符")
    if req.type not in ("feedback", "feature_request"):
        raise HTTPException(status_code=422, detail="类型只能是 feedback 或 feature_request")

    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO platform_feedback (user_code, user_nickname, type, content)
               VALUES ($1, $2, $3, $4)""",
            user["code"], user["nickname"], req.type, content,
        )
    return {
        "code": 0,
        "msg": "感谢你的反馈！灵境团队会认真处理每一条建议。",
    }


# ══════════════════════════════════════════════════════
# ── 实名认证 ──────────────────────────────────────────

_ID_CARD_RE = re.compile(r'^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$')
_BANK_CARD_RE = re.compile(r'^\d{16,19}$')


def _validate_id_card(id_card: str) -> bool:
    """Validate ID card number format (18 digits)"""
    if not id_card:
        return True
    return bool(_ID_CARD_RE.match(id_card))


def _validate_bank_card(bank_card: str) -> bool:
    """Validate bank card number format (16-19 digits)"""
    if not bank_card:
        return True
    return bool(_BANK_CARD_RE.match(bank_card))


@router.post("/verify-identity")
async def verify_identity(req: IdentityVerificationRequest, user: dict = Depends(get_current_user)):
    """Submit identity verification: real_name(required) + id_card_number + bank_card_number"""
    real_name = req.real_name.strip()
    id_card = req.id_card_number.strip()
    bank_card = req.bank_card_number.strip()

    if not real_name or len(real_name) < 2 or len(real_name) > 20:
        raise HTTPException(status_code=422, detail="真实姓名需要2-20个字符")
    if not _validate_id_card(id_card):
        raise HTTPException(status_code=422, detail="身份证号格式不正确，应为18位")
    if not _validate_bank_card(bank_card):
        raise HTTPException(status_code=422, detail="银行卡号格式不正确，应为16-19位数字")

    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="当前账号不支持实名认证，请使用用户名密码登录")

    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, status FROM user_verifications WHERE user_id=$1", user_id,
        )
        if existing:
            if existing["status"] == "approved":
                return {"code": 0, "msg": "您已完成实名认证", "status": "approved"}
            await conn.execute(
                """UPDATE user_verifications
                   SET real_name=$1, id_card_number=$2, bank_card_number=$3,
                       status='pending', updated_at=NOW()
                   WHERE user_id=$4""",
                real_name, id_card, bank_card, user_id,
            )
        else:
            await conn.execute(
                """INSERT INTO user_verifications
                   (user_id, real_name, id_card_number, bank_card_number, status)
                   VALUES ($1, $2, $3, $4, 'pending')""",
                user_id, real_name, id_card, bank_card,
            )

    return {
        "code": 0,
        "msg": "实名认证信息已提交",
        "status": "pending",
    }


@router.get("/verification-status")
async def get_verification_status(user: dict = Depends(get_current_user)):
    """Query current user's identity verification status"""
    user_id = user.get("user_id")
    if not user_id:
        return {"code": 0, "verified": False, "status": "not_applicable",
                "msg": "邀请码用户无需实名认证"}

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT real_name, id_card_number, bank_card_number, status, created_at "
            "FROM user_verifications WHERE user_id=$1",
            user_id,
        )
    if not row:
        return {"code": 0, "verified": False, "status": "unverified",
                "msg": "尚未提交实名认证"}

    return {
        "code": 0,
        "verified": row["status"] == "approved",
        "status": row["status"],
        "real_name": row["real_name"],
        "msg": "已认证" if row["status"] == "approved" else "认证审核中",
    }
