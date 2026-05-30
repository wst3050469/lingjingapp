"""
灵境 - 电话话术分析引擎

工作流:
  1. 接收通话转录文本
  2. 调用 DeepSeek AI 进行结构化分析
  3. 解析AI返回的JSON报告
  4. 返回结构化分析结果

分析维度:
  - 客户痛点提取 (含原话引用 + 严重程度)
  - 用户应对策略 (含效果评估 + 改进建议)
  - 沟通模式分析 (含频率 + 影响)
  - 情感倾向分析 (全程变化曲线)
  - 话术改进建议 (含推荐话术示例)
  - 关键词提取 (客户/用户高频词)
"""
import json
import logging
from typing import Optional

logger = logging.getLogger("lingjing.call_analysis")

# ── Prompt 模板 ──────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """你是一个专业的销售话术分析专家。分析以下通话转录文本，输出**严格的JSON格式**结构化报告。

分析要求：
1. **客户痛点** — 客户表达的核心诉求、担忧、不满或需求
2. **用户策略** — 销售人员使用了什么话术/策略应对
3. **沟通模式** — 对话结构、打断、提问方式等沟通模式
4. **情感分析** — 双方情感变化趋势
5. **改进建议** — 可操作性的话术提升建议

请仅返回JSON，不要包含任何额外文字、markdown代码块标记或注释。

输出JSON Schema:
{
  "summary": "对话整体摘要(80字内)",
  "customer_pain_points": [
    {"point": "痛点描述", "quote": "客户原话引用", "severity": "high/medium/low"}
  ],
  "user_strategies": [
    {"strategy": "策略描述", "effectiveness": "high/medium/low", "suggestions": "改进建议"}
  ],
  "communication_patterns": [
    {"pattern": "模式描述", "frequency": 2, "impact": "positive/negative/neutral"}
  ],
  "sentiment_analysis": {
    "overall_customer": "positive/neutral/negative",
    "overall_user": "positive/neutral/negative",
    "customer_tone_changes": [
      {"phase": "开场/中段/结尾", "tone": "initial/neutral/positive"}
    ],
    "key_moments": [
      {"time": "情绪转折点描述", "trigger": "触发因素", "effect": "转折效果"}
    ]
  },
  "improvement_suggestions": [
    {
      "area": "改进领域",
      "suggestion": "具体改进建议",
      "priority": "high/medium/low",
      "example_script": "推荐话术示例(50字内)"
    }
  ],
  "key_phrases": {
    "customer": ["客户高频词/关键句"],
    "user": ["用户常用话术/表达"]
  },
  "call_score": 75,
  "score_breakdown": {
    "opening": 80,
    "listening": 70,
    "closing": 75,
    "objection_handling": 65
  }
}"""


async def analyze_call_transcript(
    transcript_text: str,
    call_title: str = "通话分析",
    model: Optional[str] = None,
) -> dict:
    """分析通话转录文本，返回结构化报告

    Args:
        transcript_text: 通话转录全文
        call_title: 通话标题
        model: 指定 AI 模型 (默认 DeepSeek)

    Returns:
        dict: 包含分析结果的状态和数据的字典
            {
                "success": True/False,
                "result": {...} or None,
                "error": "错误信息" or None
            }
    """
    if not transcript_text or not transcript_text.strip():
        return {"success": False, "result": None, "error": "转录文本为空"}

    # 文本截断保护（DeepSeek context window 约32K tokens）
    max_chars = 15000
    if len(transcript_text) > max_chars:
        logger.warning(f"转录文本过长 ({len(transcript_text)}字)，截断至 {max_chars} 字")
        transcript_text = transcript_text[:max_chars] + "\n\n[对话内容过长，已截断]"

    # 构建分析 prompt
    user_prompt = f"""通话标题：{call_title}

通话转录文本：
```
{transcript_text}
```

请分析以上通话内容，返回JSON格式的结构化分析报告。"""

    # 调用 DeepSeek AI
    try:
        from services.ai_chat import stream_chat

        messages = [
            {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        full_content = ""
        async for chunk in stream_chat(messages, model=model or "deepseek-v4-flash", max_tokens=3000):
            if chunk["type"] == "chunk":
                full_content += chunk["content"]
            elif chunk["type"] == "error":
                return {"success": False, "result": None, "error": f"AI调用失败: {chunk['content']}"}

        if not full_content:
            return {"success": False, "result": None, "error": "AI返回空内容"}

        # 解析 JSON（AI有时会包在 markdown 代码块中）
        result = _parse_analysis_json(full_content)
        if result is None:
            return {
                "success": False,
                "result": None,
                "error": "AI返回格式异常，无法解析为JSON",
                "raw_text": full_content[:500],  # 返回部分原始内容用于调试
            }

        return {"success": True, "result": result, "error": None}

    except Exception as e:
        logger.error(f"分析通话失败: {e}", exc_info=True)
        return {"success": False, "result": None, "error": f"分析异常: {str(e)}"}


def _parse_analysis_json(text: str) -> Optional[dict]:
    """从AI回复中提取并解析JSON"""
    # 尝试直接解析
    text = text.strip()

    # 移除 markdown 代码块标记
    if text.startswith("```"):
        # 找到第一个 { 和最后一个 }
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]

    # 尝试解析 JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 如果外层是字符串，尝试解析内层
    try:
        inner = json.loads(text.replace("\\n", "\n").replace("\\\"", "\""))
        if isinstance(inner, dict):
            return inner
    except json.JSONDecodeError:
        pass

    # 尝试通过正则提取 JSON 对象
    import re
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


def get_empty_analysis() -> dict:
    """返回空的分析模板"""
    return {
        "summary": "分析未完成",
        "customer_pain_points": [],
        "user_strategies": [],
        "communication_patterns": [],
        "sentiment_analysis": {
            "overall_customer": "neutral",
            "overall_user": "neutral",
            "customer_tone_changes": [],
            "key_moments": [],
        },
        "improvement_suggestions": [],
        "key_phrases": {"customer": [], "user": []},
        "call_score": 0,
        "score_breakdown": {
            "opening": 0, "listening": 0,
            "closing": 0, "objection_handling": 0,
        },
    }
