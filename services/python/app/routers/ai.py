"""AI对话路由"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import logging

from services import UserService, ProjectService, AttendanceService, TaskService, ApprovalService
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai.classifier import IntentClassifier
from ai.extractor import EntityExtractor
from ai.intents import Intent, TargetType

router = APIRouter(prefix="/api/ai", tags=["AI对话"])
logger = logging.getLogger(__name__)

# 初始化服务
user_service = UserService()
project_service = ProjectService()
attendance_service = AttendanceService()
task_service = TaskService()
approval_service = ApprovalService()

# AI组件
classifier = IntentClassifier()
extractor = EntityExtractor()

class ChatRequest(BaseModel):
    text: str
    user_id: str
    tenant_id: str
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    response: str
    action: str
    intent: Optional[str] = None
    data: Optional[dict] = None

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """处理AI对话"""
    try:
        # 1. 意图分类
        intent, target_type = classifier.classify(req.text)
        
        # 2. 实体提取
        entities = extractor.extract(req.text, {})
        entities["target_type"] = target_type

        # 3. 根据意图处理
        if intent == Intent.CHECK_IN:
            result = await attendance_service.check_in(req.user_id, entities.get("location"))
            if result.get("success"):
                return ChatResponse(
                    response=f"✓ 上班打卡成功\n时间：{result.get('check_time')}",
                    action="done",
                    intent="check_in"
                )
            return ChatResponse(
                response=f"打卡失败: {result.get('error')}",
                action="error",
                intent="check_in"
            )
        
        elif intent == Intent.CHECK_OUT:
            result = await attendance_service.check_out(req.user_id, entities.get("location"))
            if result.get("success"):
                hours = result.get("hours", 0)
                return ChatResponse(
                    response=f"✓ 下班打卡成功\n工作时长：{hours:.1f}小时",
                    action="done",
                    intent="check_out"
                )
            return ChatResponse(
                response=f"打卡失败: {result.get('error')}",
                action="error",
                intent="check_out"
            )
        
        elif intent == Intent.READ:
            if target_type == TargetType.ATTENDANCE:
                records = await attendance_service.get_today_records(req.user_id)
                text = "今日考勤：\n"
                for r in records:
                    text += f"• {r['type']} {r['check_time']}\n"
                return ChatResponse(
                    response=text or "今日暂无打卡记录",
                    action="done",
                    intent="read"
                )
            elif target_type == TargetType.PROJECT:
                projects = await project_service.list_projects(req.tenant_id)
                text = "当前项目列表：\n"
                for p in projects[:10]:
                    text += f"• {p['name']} (进度: {p.get('progress', 0)}%)\n"
                return ChatResponse(
                    response=text or "暂无项目",
                    action="done",
                    intent="read"
                )
            return ChatResponse(
                response="请告诉我您想查询什么？比如：'查看所有项目'、'查看我的任务'",
                action="ask",
                intent="read"
            )
        
        elif intent == Intent.STATS:
            stats = await attendance_service.get_month_stats(req.user_id, entities.get("date"))
            return ChatResponse(
                response=f"本月统计：\n出勤天数：{stats.get('days', 0)}天\n加班时长：{stats.get('overtime', 0)}小时",
                action="done",
                intent="stats"
            )
        
        elif intent == Intent.HELP:
            help_text = """灵境AI助手可以帮您：
• 查看项目：查看所有项目
• 智能问答：问我任何问题
• 下班打卡：下班了，打下班卡
• 查看考勤：查看今天考勤
• 本月统计：本月出勤多少天
请告诉我您想做什么？"""
            return ChatResponse(response=help_text, action="done", intent="help")
        
        else:
            return ChatResponse(
                response="请告诉我您想做什么？我可以帮您打卡、查项目、统计等。",
                action="ask",
                intent=intent.value if intent else None
            )
            
    except Exception as e:
        logger.exception(f"处理对话失败: {e}")
        return ChatResponse(response=f"处理失败: {str(e)}", action="error")

@router.get("/intents")
async def list_intents():
    """获取支持的意图列表"""
    return {
        "intents": [
            {"code": "create", "name": "创建", "keywords": ["添加", "创建", "新建"]},
            {"code": "read", "name": "查询", "keywords": ["查看", "查询", "看看"]},
            {"code": "check_in", "name": "上班打卡", "keywords": ["打卡", "签到", "上班"]},
            {"code": "check_out", "name": "下班打卡", "keywords": ["下班", "签退"]},
            {"code": "stats", "name": "统计查询", "keywords": ["统计", "多少"]},
        ]
    }
