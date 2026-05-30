"""灵境AI - 对话管理器"""
from .intents import Intent, TargetType
from .classifier import IntentClassifier
from .extractor import EntityExtractor
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class DialogueManager:
    """多轮对话管理器（同步调用版）"""

    def __init__(self):
        self.classifier = IntentClassifier()
        self.extractor = EntityExtractor()
        self.services = {}
        self.sessions = {}

        self.handlers = {
            Intent.CREATE: self._handle_create,
            Intent.READ: self._handle_read,
            Intent.UPDATE: self._handle_update,
            Intent.DELETE: self._handle_delete,
            Intent.APPROVE: self._handle_approve,
            Intent.REJECT: self._handle_reject,
            Intent.CHECK_IN: self._handle_check_in,
            Intent.CHECK_OUT: self._handle_check_out,
            Intent.ASSIGN: self._handle_assign,
            Intent.SUBMIT: self._handle_submit,
            Intent.STATS: self._handle_stats,
            Intent.HELP: self._handle_help,
        }

    def register_service(self, name: str, service: Any):
        self.services[name] = service

    def process(self, user_id: str, text: str, tenant_id: str = None) -> Dict[str, Any]:
        try:
            intent, target_type = self.classifier.classify(text)
            context = self._get_context(user_id, tenant_id)
            entities = self.extractor.extract(text, context)
            entities["target_type"] = target_type

            handler = self.handlers.get(intent)
            if handler:
                result = handler(user_id, tenant_id, intent, entities)
                return result

            return {
                "response": "抱歉，我不太理解您的意思。请尝试其他说法。",
                "action": "error",
                "intent": intent.value if intent else None,
            }
        except Exception as e:
            logger.exception(f"处理对话失败: {e}")
            return {"response": f"处理失败: {str(e)}", "action": "error"}

    def _get_context(self, user_id: str, tenant_id: str) -> Dict:
        return {}

    def _handle_create(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        target_type = entities.get("target_type")
        if target_type == TargetType.USER:
            service = self.services.get("user")
            if service:
                result = service.create_user(
                    tenant_id=tenant_id,
                    name=entities.get("name"),
                    phone=entities.get("phone"),
                    role=entities.get("role"),
                )
                if result.get("success"):
                    return {
                        "response": f"✓ {entities.get('name')}已创建完成\n角色：{entities.get('role', '员工')}",
                        "action": "done",
                        "data": result,
                    }
                return {"response": f"创建失败: {result.get('error')}", "action": "error"}
        return {"response": "请告诉我您要创建什么？", "action": "ask"}

    def _handle_read(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        target_type = entities.get("target_type")
        if "用户" in str(target_type.value):
            service = self.services.get("user")
            if service:
                users = service.list_users(tenant_id)
                if users:
                    text = "当前用户列表：\n"
                    for u in users[:10]:
                        text += f"• {u['name']} ({u.get('roles', ['员工'])[0]})\n"
                    return {"response": text, "action": "done"}
        if target_type == TargetType.PROJECT:
            service = self.services.get("project")
            if service:
                projects = service.list_projects(tenant_id)
                if projects:
                    text = "当前项目列表：\n"
                    for p in projects[:10]:
                        text += f"• {p['name']} (进度: {p.get('progress', 0)}%)\n"
                    return {"response": text, "action": "done"}
        if target_type == TargetType.ATTENDANCE:
            service = self.services.get("attendance")
            if service:
                records = service.get_today_records(user_id)
                text = "今日考勤：\n"
                for r in records:
                    text += f"• {r['type']} {r['check_time']}\n"
                return {"response": text or "今日暂无打卡记录", "action": "done"}
        return {"response": "请告诉我您想查询什么？", "action": "ask"}

    def _handle_check_in(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("attendance")
        if service:
            result = service.check_in(user_id, entities.get("location"))
            if result.get("success"):
                return {
                    "response": f"✓ 上班打卡成功\n时间：{result.get('check_time')}",
                    "action": "done",
                }
            return {"response": f"打卡失败: {result.get('error')}", "action": "error"}
        return {"response": "打卡功能暂不可用", "action": "error"}

    def _handle_check_out(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("attendance")
        if service:
            result = service.check_out(user_id, entities.get("location"))
            if result.get("success"):
                hours = result.get("hours", 0)
                return {
                    "response": f"✓ 下班打卡成功\n工作时长：{hours:.1f}小时",
                    "action": "done",
                }
            return {"response": f"打卡失败: {result.get('error')}", "action": "error"}
        return {"response": "打卡功能暂不可用", "action": "error"}

    def _handle_approve(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("approval")
        if service:
            service.approve(
                record_id=entities.get("record_id"),
                approver_id=user_id,
                comment=entities.get("comment"),
            )
            return {"response": "✓ 审批已通过", "action": "done"}
        return {"response": "审批功能暂不可用", "action": "error"}

    def _handle_reject(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        return {"response": "请说明驳回原因，我会记录。", "action": "ask"}

    def _handle_assign(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("task")
        if service:
            service.create_task(
                tenant_id=tenant_id,
                title=entities.get("title") or "新任务",
                assignee_id=entities.get("assignee_id"),
                project_id=entities.get("project_id"),
                due_date=entities.get("date"),
            )
            return {
                "response": f"✓ 任务已指派\n截止时间：{entities.get('date', '待定')}",
                "action": "done",
            }
        return {"response": "任务功能暂不可用", "action": "error"}

    def _handle_stats(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("attendance")
        if service:
            stats = service.get_month_stats(user_id, entities.get("date"))
            return {
                "response": f"本月统计：\n出勤天数：{stats.get('days', 0)}天\n加班时长：{stats.get('overtime', 0)}小时",
                "action": "done",
            }
        return {"response": "统计功能暂不可用", "action": "error"}

    def _handle_submit(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        service = self.services.get("approval")
        if service:
            service.create_approval(
                tenant_id=tenant_id,
                applicant_id=user_id,
                title=entities.get("title") or "通用申请",
                amount=entities.get("amount", 0),
                type=entities.get("approval_type"),
            )
            return {"response": "✓ 申请已提交，等待审批", "action": "done"}
        return {"response": "申请功能暂不可用", "action": "error"}

    def _handle_help(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        help_text = """灵境AI助手可以帮您：
• 添加用户：添加一个项目经理，叫张三
• 查看项目：查看所有项目
• 上班打卡：到了，打上班卡
• 下班打卡：下班了，打下班卡
• 查看考勤：查看今天考勤
• 本月统计：本月出勤多少天
请告诉我您想做什么？"""
        return {"response": help_text, "action": "done"}

    def _handle_update(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        return {"response": "请告诉我您想修改什么？", "action": "ask"}

    def _handle_delete(self, user_id: str, tenant_id: str, intent: Intent, entities: Dict) -> Dict:
        return {"response": "请告诉我您想删除什么？", "action": "ask"}
