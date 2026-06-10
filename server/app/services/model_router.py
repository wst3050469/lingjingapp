"""
灵境 - 智能模型路由 (Model Router)
对标 OpenHuman's Automatic Model Routing

核心功能：根据任务类型自动选择最合适的 AI 模型。
任务通过 hint prefix 指定意图，路由表解析为 (provider, model) 对。

Hint 体系 (对标 OpenHuman):
  hint:reasoning  → 强推理模型 (复杂业务分析/代码/数学)
  hint:fast       → 快速模型 (简单分类/意图检测/关键词提取)
  hint:vision     → 视觉模型 (图片分析/OCR/图表)
  hint:summary    → 摘要模型 (记忆压缩/报告生成)
  hint:code       → 代码模型 (SQL查询/脚本生成)
  hint:default    → 默认模型 (通用对话)

用法:
    from model_router import resolve_model
    provider, model = resolve_model("hint:reasoning")
    # → ("deepseek", "deepseek-chat")

    # 手动指定具体模型
    provider, model = resolve_model("ollama/gemma4:latest")
    # → ("ollama", "gemma4:latest")
"""

import logging
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger("lingjing.model_router")

# ── 默认路由表 ─────────────────────────────────────────────
# 结构: hint → (provider, model_name)
# 可在 config.py 中通过 MODEL_ROUTES 覆盖

_DEFAULT_ROUTES = {
    "reasoning":  ("deepseek", "deepseek-chat"),
    "fast":       ("ollama",   "gemma4:latest"),
    "vision":     ("ollama",   "gemma4:26b"),
    "summary":    ("deepseek", "deepseek-chat"),
    "code":       ("deepseek", "deepseek-chat"),
    "default":    ("deepseek", "deepseek-chat"),
}

# ── Provider 映射 ──────────────────────────────────────────
# provider名 → 实际调用时的 model 参数值
_PROVIDER_MODEL_MAP = {
    "deepseek": {
        "model_param": None,  # None = 使用 config.DEEPSEEK_MODEL
        "display_name": "DeepSeek",
    },
    "ollama": {
        "model_param": "ollama",  # "ollama" = 触发 ai_chat 的 Ollama 路径
        "display_name": "Ollama",
    },
}


def _get_routes() -> dict:
    """获取路由表（支持 config.py 覆盖）"""
    custom = getattr(config, "MODEL_ROUTES", None)
    if custom and isinstance(custom, dict):
        merged = dict(_DEFAULT_ROUTES)
        merged.update(custom)
        return merged
    return dict(_DEFAULT_ROUTES)


def resolve_model(hint_or_model: str) -> tuple:
    """解析 hint 或模型名为 (provider, model_key)

    Args:
        hint_or_model: 支持以下格式
            - "hint:reasoning" / "hint:fast" / "hint:vision" 等
            - "deepseek" / "ollama" — 直接指定 provider
            - "deepseek/deepseek-chat" — provider/model 格式

    Returns:
        (provider, model_key): 供 ai_chat.stream_chat() 使用的参数
            provider: 用于日志/追踪
            model_key: 传给 stream_chat 的 model 参数
    """
    routes = _get_routes()

    # 1. Hint prefix 格式
    if hint_or_model.startswith("hint:"):
        hint = hint_or_model[5:]  # 去掉 "hint:" 前缀
        if hint in routes:
            provider, model_name = routes[hint]
            model_key = _PROVIDER_MODEL_MAP.get(provider, {}).get("model_param", model_name)
            logger.debug(f"ModelRouter: hint:{hint} → {provider}/{model_name}")
            return provider, model_key
        # hint 不存在，走默认
        logger.warning(f"ModelRouter: 未知 hint '{hint}'，使用默认路由")
        provider, model_name = routes["default"]
        model_key = _PROVIDER_MODEL_MAP.get(provider, {}).get("model_param", model_name)
        return provider, model_key

    # 2. "provider/model" 格式
    if "/" in hint_or_model:
        parts = hint_or_model.split("/", 1)
        provider = parts[0]
        model_name = parts[1]
        model_key = _PROVIDER_MODEL_MAP.get(provider, {}).get("model_param", model_name)
        return provider, model_key

    # 3. 仅 provider 名
    if hint_or_model in ("deepseek", "ollama"):
        provider = hint_or_model
        model_key = _PROVIDER_MODEL_MAP.get(provider, {}).get("model_param", hint_or_model)
        return provider, model_key

    # 4. 未知格式，走默认
    logger.warning(f"ModelRouter: 无法识别 '{hint_or_model}'，使用默认路由")
    provider, model_name = routes["default"]
    model_key = _PROVIDER_MODEL_MAP.get(provider, {}).get("model_param", model_name)
    return provider, model_key


def detect_task_hint(messages: list[dict]) -> str:
    """根据消息内容自动检测任务类型，返回 hint

    对标 OpenHuman：agent loop 根据任务 emit hint，
    无需用户手动选择模型。

    Args:
        messages: 对话消息列表 [{"role": "...", "content": "..."}]

    Returns:
        hint 字符串: "hint:reasoning" / "hint:fast" / "hint:vision" / "hint:default"
    """
    # 获取最后一条用户消息
    user_msg = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            user_msg = m.get("content", "")
            break

    if not user_msg:
        return "hint:default"

    # 检测图片/视觉需求
    vision_keywords = [
        "图片", "照片", "截图", "拍照", "看图", "识别",
        "这是什么", "看到什么", "图中",
    ]
    if any(kw in user_msg for kw in vision_keywords):
        return "hint:vision"

    # 检测推理/分析需求
    reasoning_keywords = [
        "分析", "对比", "总结", "为什么", "如何", "计算",
        "方案", "规划", "策略", "评估", "预测", "推理",
    ]
    reasoning_count = sum(1 for kw in reasoning_keywords if kw in user_msg)
    if reasoning_count >= 2 or len(user_msg) > 100:
        return "hint:reasoning"

    # 检测代码/SQL需求
    code_keywords = ["sql", "代码", "脚本", "函数", "查询", "select", "update", "delete"]
    if any(kw in user_msg.lower() for kw in code_keywords):
        return "hint:code"

    # 检测摘要需求
    summary_keywords = ["摘要", "总结", "概括", "浓缩", "简要"]
    if any(kw in user_msg for kw in summary_keywords):
        return "hint:summary"

    # 默认
    return "hint:default"


def get_available_routes() -> dict:
    """获取当前所有可用路由（用于管理后台显示）"""
    routes = _get_routes()
    result = {}
    for hint, (provider, model) in routes.items():
        info = _PROVIDER_MODEL_MAP.get(provider, {})
        result[hint] = {
            "provider": provider,
            "model": model,
            "display_name": info.get("display_name", provider),
        }
    return result
