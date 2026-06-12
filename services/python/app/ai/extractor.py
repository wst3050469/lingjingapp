"""灵境AI - 实体提取器"""
import re
from typing import Dict, Optional, Any
from datetime import datetime, timedelta

class EntityExtractor:
    """实体提取器"""

    def __init__(self):
        self.today = datetime.now().date()

    def extract(self, text: str, context: Dict = None) -> Dict[str, Any]:
        """
        从文本中提取实体
        返回: {name, role, amount, date, project_name, ...}
        """
        entities = {}
        context = context or {}

        # 提取人名（简单匹配）
        entities["name"] = self._extract_name(text)

        # 提取手机号
        entities["phone"] = self._extract_phone(text)

        # 提取金额
        entities["amount"] = self._extract_amount(text)

        # 提取日期
        entities["date"] = self._extract_date(text)

        # 提取角色
        entities["role"] = self._extract_role(text)

        # 提取项目名
        entities["project_name"] = self._extract_project_name(text, context)

        # 提取优先级
        entities["priority"] = self._extract_priority(text)

        return entities

    def _extract_name(self, text: str) -> Optional[str]:
        """提取人名"""
        # 简单实现：匹配 "叫XXX" 或 "XXX说"
        patterns = [
            r'叫(\w{2,4})',
            r'^(\w{2,4})(?:，|,|。|\s|$)',
            r'用户名[是为]*(\w{2,4})',
            r'姓名[是为]*(\w{2,4})',
        ]
        for p in patterns:
            m = re.search(p, text)
            if m:
                return m.group(1)
        return None

    def _extract_phone(self, text: str) -> Optional[str]:
        """提取手机号"""
        m = re.search(r'1[3-9]\d{9}', text)
        return m.group() if m else None

    def _extract_amount(self, text: str) -> Optional[float]:
        """提取金额"""
        # 匹配 "5000元" "5000" "5万元"
        patterns = [
            r'(\d+(?:\.\d+)?)\s*万元',
            r'([¥￥$]?\s*\d+(?:\.\d+)?)\s*(?:元|块)',
        ]
        for p in patterns:
            m = re.search(p, text)
            if m:
                amount_str = re.sub(r'[¥￥$\s]', '', m.group(1))
                if '万' in p:
                    return float(amount_str) * 10000
                return float(amount_str)
        return None

    def _extract_date(self, text: str) -> Optional[str]:
        """提取日期"""
        today = self.today

        if "今天" in text:
            return today.isoformat()
        if "明天" in text:
            return (today + timedelta(days=1)).isoformat()
        if "昨天" in text:
            return (today - timedelta(days=1)).isoformat()
        if "前天" in text:
            return (today - timedelta(days=2)).isoformat()

        # 匹配日期格式
        m = re.search(r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})', text)
        if m:
            return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

        m = re.search(r'(\d{1,2})[月/-](\d{1,2})', text)
        if m:
            year = today.year
            return f"{year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

        return None

    def _extract_role(self, text: str) -> Optional[str]:
        """提取角色"""
        role_map = {
            "管理员": "admin",
            "超级管理员": "super_admin",
            "经理": "manager",
            "员工": "employee",
            "财务": "finance",
            "客户": "customer",
            "负责人": "owner",
            "成员": "member",
        }
        for name, code in role_map.items():
            if name in text:
                return code
        return None

    def _extract_project_name(self, text: str, context: Dict) -> Optional[str]:
        """提取项目名"""
        projects = context.get("projects", [])

        for p in projects:
            if p.get("name") in text:
                return p["name"]
            if p.get("no") and p["no"] in text:
                return p["name"]

        # 尝试直接匹配
        m = re.search(r'["\"]([^"\"]+)["\"]的项目', text)
        if m:
            return m.group(1)

        return None

    def _extract_priority(self, text: str) -> Optional[str]:
        """提取优先级"""
        if "紧急" in text or "高" in text:
            return "high"
        if "低" in text:
            return "low"
        return "normal"
