"""
灵境 - 自然语言任务解析器
用 AI 将用户的自然语言描述转换为结构化定时任务定义。

输入示例:
  "每天早上8点给我汇报当天的出工人数"
  "下午6点汇报当天的打卡情况"

输出 (JSON):
  {
    "cron_expr": "0 8 * * *",
    "task_type": "worker_count_report",
    "query_config": { ... },
    "target_roles": ["owner", "admin"],
    "reasoning": "..."
  }
"""
import json, re, httpx, logging
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger("lingjing.task_parser")

TASK_TYPES_INFO = {
    "worker_count_report": {"label": "出工人数汇报", "desc": "统计各项目当天出工人数/总人数/出工率", "example": "每天早上8点汇报出工人数"},
    "attendance_report": {"label": "打卡情况汇报", "desc": "汇报当天打卡统计（迟到/缺卡/早退）", "example": "下午6点汇报打卡情况"},
    "finance_summary": {"label": "财务数据汇总", "desc": "汇总待审批报销/备用金/工资总笔数和金额", "example": "每天中午汇报待审批财务"},
    "quality_alert": {"label": "质量预警", "desc": "检测不合格样板/退审记录主动预警", "example": "有质量问题立即通知我"},
    "progress_reminder": {"label": "进度提醒", "desc": "提醒项目经理更新项目进度", "example": "每周一提醒项目经理汇报进度"},
    "schedule_reminder": {"label": "排班提醒", "desc": "提醒项目经理排班/人员调配", "example": "每周日晚提醒排班"},
    "checkin_reminder": {"label": "打卡提醒", "desc": "提醒工人上下班打卡", "example": "每天早上8点半提醒工人打卡"},
    "task_overdue_report": {"label": "超期任务汇报", "desc": "汇报超期未完成的任务列表", "example": "提醒我哪些任务超期了"},
    "project_summary": {"label": "项目综合汇报", "desc": "汇总所有项目状态/进度/人员/财务", "example": "每周五汇总所有项目情况"},
    "custom": {"label": "自定义", "desc": "用户自定义的灵活查询", "example": "有新的审批时通知我"},
}

ROLES_INFO = {
    "owner": "租户所有者/企业老板",
    "admin": "租户管理员",
    "project_manager": "项目经理",
    "worker": "工人/施工人员",
}

PARSER_PROMPT = """你是任务JSON生成器。将自然语言转为定时任务JSON，只输出JSON对象。

## 任务类型:
{task_types}

## 角色:
{roles}

## Cron规则(分 时 日 月 周):
- "每天早上8点" → "0 8 * * *"
- "下午6点" → "0 18 * * *"
- "每周一上午9点" → "0 9 * * 1"
- "不定时/有XX时" → "*/30 * * * *"
- "实时/立即" → "*/5 * * * *"

## 字段:
- cron_expr: str, 必须有5段
- task_type: str, 只能从上述列表选
- query_config: {{}} 可含 status/date_range等
- target_roles: [str], 从上述角色列表选
- reasoning: str, 简要说明推断理由

用户输入: "{user_input}"

只返回JSON:"""


async def parse_natural_language(user_input: str, tenant_id: str = "") -> dict:
    """用AI将自然语言解析为结构化任务定义"""
    type_lines = [f"  - {k}: {v['label']} — {v['desc']}" for k, v in TASK_TYPES_INFO.items()]
    role_lines = [f"  - {k}: {v}" for k, v in ROLES_INFO.items()]
    prompt = PARSER_PROMPT.format(
        task_types="\n".join(type_lines),
        roles="\n".join(role_lines),
        user_input=user_input,
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {config.DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": "你是JSON生成器，只返回JSON对象。"},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1, "max_tokens": 500,
                    "response_format": {"type": "json_object"},
                },
            )
            if resp.status_code != 200:
                logger.error(f"AI解析 HTTP {resp.status_code}: {resp.text[:200]}")
                return {"success": False, "error": f"AI响应异常({resp.status_code})", "fallback_manual": True}
            
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            if content.startswith("```"): content = "\n".join(content.split("\n")[1:-1])
            parsed = json.loads(content)
            
            for f in ["cron_expr", "task_type", "target_roles"]:
                if f not in parsed: raise ValueError(f"缺少字段: {f}")
            if parsed["task_type"] not in TASK_TYPES_INFO: parsed["task_type"] = "custom"
            if len(parsed["cron_expr"].strip().split()) != 5: parsed["cron_expr"] = "0 9 * * *"
            if not isinstance(parsed.get("query_config"), dict): parsed["query_config"] = {}
            if not isinstance(parsed.get("target_roles"), list): parsed["target_roles"] = ["owner", "admin"]
            
            logger.info(f"NL解析: '{user_input[:50]}' → {parsed['task_type']} @ {parsed['cron_expr']}")
            return {"success": True, "parsed": parsed, "fallback_manual": False}
    except json.JSONDecodeError:
        return {"success": False, "error": "AI返回格式异常，请简化描述", "fallback_manual": True}
    except httpx.TimeoutException:
        return {"success": False, "error": "AI解析超时", "fallback_manual": True}
    except Exception as e:
        logger.error(f"NL解析异常: {e}")
        return {"success": False, "error": str(e)[:200], "fallback_manual": True}


def manual_parse(user_input: str) -> dict:
    """关键词回退解析，标记fallback_manual=True让用户在UI确认"""
    result = {"cron_expr": "0 9 * * *", "task_type": "custom", "query_config": {},
              "target_roles": ["owner", "admin"], "reasoning": "关键词匹配推断，请手动调整"}
    
    # 时间
    tm = re.search(r'(\d{1,2})[点时](\d{0,2})?', user_input)
    h, m = 9, 0
    if tm: h = int(tm.group(1)); m = int(tm.group(2)) if tm.group(2) else 0
    if any(k in user_input for k in ['下午','晚上']):
        if h < 12: h += 12
    if '中午' in user_input: h = 12
    
    wk = '*'; wm = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0}
    for cn, n in wm.items():
        if f'周{cn}' in user_input or f'星期{cn}' in user_input: wk = str(n); break
    dm = '*'; dm2 = re.search(r'每月(\d{1,2})[号日]', user_input)
    if dm2: dm = dm2.group(1)
    
    if any(k in user_input for k in ['不定时','有情况','随时','及时','一发生','出现','监测']): result["cron_expr"] = "*/30 * * * *"
    elif any(k in user_input for k in ['立即','实时','马上']): result["cron_expr"] = "*/5 * * * *"
    else: result["cron_expr"] = f"{m} {h} {dm} * {wk}"
    
    # 类型
    for t, kws in {"checkin_reminder": ["提醒.*打卡","提醒.*上班","提醒工人","叫.*打卡"],
                   "worker_count_report": ["出工人数","上工人数","出工"],
                   "attendance_report": ["打卡情况","考勤","缺卡","签到统计"],
                   "quality_alert": ["质量预警","不合格","质检","质量.*通知","质量.*提醒"],
                   "progress_reminder": ["进度.*汇报","汇报进度","施工.*汇报"],
                   "schedule_reminder": ["排班","调班"],
                   "finance_summary": ["财务","报销","备用金","工资","金额"],
                   "task_overdue_report": ["超期.*任务","过期.*任务","任务.*超期"],
                   "project_summary": ["项目.*汇总","所有项目","项目综合"]}.items():
        for kw in kws:
            if re.search(kw, user_input): result["task_type"] = t; break
        if result["task_type"] != "custom": break
    
    # 目标角色（注意先后顺序：工人类检查优先，但汇报类保持owner/admin）
    if any(k in user_input for k in ['提醒工人','让工人','通知工人','叫工人']):
        result["target_roles"] = ["worker"]
    elif '项目经理' in user_input or 'pm' in user_input.lower():
        result["target_roles"] = ["project_manager"]
    elif any(k in user_input for k in ['给我','向我','通知我','汇报我']):
        result["target_roles"] = ["owner", "admin"]  # 汇报给管理层
    
    result["reasoning"] = f"关键词推断: {result['task_type']} @ {result['cron_expr']}"
    return {"success": True, "parsed": result, "fallback_manual": True}
