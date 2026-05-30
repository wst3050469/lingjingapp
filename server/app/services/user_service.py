"""用户管理服务"""
import hashlib
import secrets
from typing import Optional, List, Dict
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db

class UserService:
    """用户管理服务"""

    @staticmethod
    def hash_password(password: str) -> str:
        """密码哈希"""
        return hashlib.sha256(password.encode()).hexdigest()

    @staticmethod
    def generate_password() -> str:
        """生成随机密码"""
        return secrets.token_hex(4)[:8]

    async def create_user(self, tenant_id: str, name: str, phone: str = None,
                          email: str = None, roles: List[str] = None,
                          position: str = None) -> Dict:
        """创建用户"""
        # 检查手机号
        if phone:
            existing = await db.fetchone(
                "SELECT id FROM users WHERE phone = $1", (phone,)
            )
            if existing:
                return {"success": False, "error": f"手机号 {phone} 已被使用"}

        # 生成密码
        password = self.generate_password()
        password_hash = self.hash_password(password)

        # 创建用户
        user_id = await db.insert(
            """INSERT INTO users
               (tenant_id, name, phone, email, roles, password_hash, position)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id""",
            (tenant_id, name, phone, email, roles or ["employee"],
             password_hash, position)
        )

        return {
            "success": True,
            "user_id": user_id,
            "password": password,
            "name": name,
            "phone": phone,
        }

    async def get_user(self, user_id: str) -> Optional[Dict]:
        """获取用户"""
        return await db.fetchone(
            "SELECT * FROM users WHERE id = $1", (user_id,)
        )

    async def get_user_by_phone(self, phone: str) -> Optional[Dict]:
        """根据手机号获取用户"""
        return await db.fetchone(
            "SELECT * FROM users WHERE phone = $1", (phone,)
        )

    async def list_users(self, tenant_id: str, role: str = None) -> List[Dict]:
        """获取用户列表"""
        if role:
            sql = """SELECT * FROM users WHERE tenant_id = $1 AND $2 = ANY(roles) AND status = 'active' ORDER BY created_at DESC"""
            return await db.fetchall(sql, (tenant_id, role))
        sql = "SELECT * FROM users WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC"
        return await db.fetchall(sql, (tenant_id,))

    async def update_user(self, user_id: str, **fields) -> Dict:
        """更新用户"""
        if "password" in fields:
            fields["password_hash"] = self.hash_password(fields.pop("password"))

        sets = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(fields.keys())])
        sql = f"UPDATE users SET {sets}, updated_at = NOW() WHERE id = $1 RETURNING *"

        return await db.fetchone(sql, (user_id, *fields.values()))

    async def delete_user(self, user_id: str) -> bool:
        """删除用户（软删除）"""
        await db.execute(
            "UPDATE users SET status = 'deleted', deleted_at = NOW() WHERE id = $1",
            (user_id,)
        )
        return True

    async def add_role(self, user_id: str, role: str) -> bool:
        """添加角色"""
        await db.execute(
            "UPDATE users SET roles = array_distinct(roles || $2), updated_at = NOW() WHERE id = $1",
            (user_id, role)
        )
        return True

    async def remove_role(self, user_id: str, role: str) -> bool:
        """移除角色"""
        await db.execute(
            "UPDATE users SET roles = array_remove(roles, $2), updated_at = NOW() WHERE id = $1",
            (user_id, role)
        )
        return True
