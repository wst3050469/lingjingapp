"""灵境平台 - AI聊天调用服务 (DeepSeek流式 + Ollama本地 + 智能路由)"""
import json
import logging
import httpx
from typing import AsyncGenerator
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from .model_router import resolve_model

# ── 模型选择器 ──────────────────────────────────────────
# 通过 chat.py 传入 model 参数选择后端:
#   "deepseek" 或 None → DeepSeek API
#   "ollama"           → 本地 Ollama (gemma4:26b)
#   "hint:xxx"         → 智能模型路由 (Model Router)
#   其他字符串          → 当作 DeepSeek model name

async def stream_chat(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 2000,
) -> AsyncGenerator[dict, None]:
    """
    流式调用 AI，逐块 yield。支持智能模型路由 (Model Router)。

    model 参数:
      "ollama"               → 本地 Ollama
      None / "deepseek"       → DeepSeek (使用 config.DEEPSEEK_MODEL)
      "hint:reasoning"        → 智能路由到推理模型
      "hint:fast"             → 智能路由到快速模型
      "hint:vision"           → 智能路由到视觉模型
      "hint:summary"          → 智能路由到摘要模型
      "hint:default"          → 智能路由到默认模型
    """
    # 如果带有 hint: 前缀，用 Model Router 解析
    if model and model.startswith("hint:"):
        provider, model_key = resolve_model(model)
        logger = logging.getLogger("lingjing.ai_chat")
        logger.debug(f"ModelRouter: {model} → {provider}/{model_key}")
        if provider == "ollama":
            async for chunk in _ollama_stream_chat(messages, max_tokens):
                yield chunk
        else:
            async for chunk in _deepseek_stream_chat(messages, model_key, max_tokens):
                yield chunk
    elif model == "ollama":
        async for chunk in _ollama_stream_chat(messages, max_tokens):
            yield chunk
    else:
        async for chunk in _deepseek_stream_chat(messages, model, max_tokens):
            yield chunk


async def _deepseek_stream_chat(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 2000,
) -> AsyncGenerator[dict, None]:
    """
    流式调用 DeepSeek API，逐块 yield。
    每个 yield 的 dict 格式:
      {"type": "chunk", "content": "..."}
      {"type": "done", "content": "...", "usage": {"input": N, "output": N}}
      {"type": "error", "content": "..."}
    """
    api_key = config.DEEPSEEK_API_KEY
    base_url = config.DEEPSEEK_BASE_URL
    model = model or config.DEEPSEEK_MODEL

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": True,
    }

    full_content = ""
    usage = {"input": 0, "output": 0}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    yield {"type": "error", "content": f"API错误 ({resp.status_code}): {body.decode()[:200]}"}
                    return

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        chunk = delta.get("content", "")
                        if chunk:
                            full_content += chunk
                            yield {"type": "chunk", "content": chunk}
                        # 提取 usage（部分模型在最后一个chunk返回）
                        if "usage" in data:
                            usage["input"] = data["usage"].get("prompt_tokens", 0)
                            usage["output"] = data["usage"].get("completion_tokens", 0)
                    except json.JSONDecodeError:
                        continue

        # 如果没拿到 usage，根据字符数粗略估算
        if usage["output"] == 0 and full_content:
            usage["output"] = len(full_content) // 2  # 粗略估算

        yield {"type": "done", "content": full_content, "usage": usage}

    except httpx.TimeoutException:
        yield {"type": "error", "content": "AI回复超时，请稍后重试"}
    except Exception as e:
        yield {"type": "error", "content": f"调用异常: {str(e)[:200]}"}


import re as _re

def _split_system_for_ollama(sys_content: str, max_system: int = 800) -> tuple[str, str]:
    """
    将长 system prompt 拆分为：核心人格(system) + 业务上下文(user message)。
    
    gemma4:26b + Ollama v0.20.2 在 system prompt >800 字时容易陷入思考循环。
    此函数检测 system_content 中的注入边界，将核心人格与业务数据分离。
    """
    # 标记业务上下文的注入点（按出现顺序匹配第一个）
    inject_markers = [
        r'\n\n你同时也是',               # 企业身份注入
        r'\n\n---\n以下是与当前话题相关的记忆',  # 记忆注入
        r'===== 实时业务数据 =====',      # 业务数据注入
        r'\n\n\[灵境团队通知\]',          # 团队通知
        r'\n\n用户当前绑定的项目',         # 项目信息
    ]
    
    split_pos = len(sys_content)  # 默认全保留在 system
    for marker in inject_markers:
        m = _re.search(marker, sys_content)
        if m and m.start() < split_pos:
            split_pos = m.start()
    
    # 如果核心部分仍然太长，用 max_system 硬截断
    if split_pos > max_system:
        split_pos = min(split_pos, max_system)
    
    if split_pos >= len(sys_content):
        return sys_content.strip(), ""
    
    core = sys_content[:split_pos].strip()
    context = sys_content[split_pos:].strip()
    
    if context:
        context = f"[灵境工作上下文 — 请基于以下信息回答用户问题，但不要逐字复述]\n\n{context}"
    
    return core, context


async def _ollama_stream_chat(
    messages: list[dict],
    max_tokens: int = 2000,
) -> AsyncGenerator[dict, None]:
    """
    流式调用本地 Ollama /api/chat 接口。
    输出格式与 _deepseek_stream_chat 完全一致。
    
    gemma4:26b + Ollama v0.20.2 对长 system prompt 敏感（触发思考循环），
    因此将 system prompt 拆分为：核心人格(system) + 业务上下文(user message)。
    """
    if not config.OLLAMA_CHAT_ENABLED:
        yield {"type": "error", "content": "本地 Ollama 模型未启用，请设置 OLLAMA_CHAT_ENABLED=true"}
        return

    url = config.OLLAMA_CHAT_URL
    model = config.OLLAMA_CHAT_MODEL
    timeout = config.OLLAMA_CHAT_TIMEOUT

    ollama_messages = list(messages)
    # 如果第一条不是 system 消息，插入一个引导性的 system prompt
    if not ollama_messages or ollama_messages[0].get("role") != "system":
        ollama_messages.insert(0, {
            "role": "system",
            "content": "你是一个高效的中文AI助手。请直接、简洁地回答问题，用中文。",
        })
    else:
        # 将长 system prompt 拆分：核心人格留在 system，业务上下文移到 user message
        sys_content = ollama_messages[0].get("content", "")
        if len(sys_content) > 800:
            core, context = _split_system_for_ollama(sys_content)
            ollama_messages[0]["content"] = core
            if context:
                # 注入上下文作为 user message，放在实际用户消息之前
                ctx_msg = {"role": "user", "content": context}
                ollama_messages.insert(-1, ctx_msg)

    payload = {
        "model": model,
        "messages": ollama_messages,
        "stream": True,
        "keep_alive": -1,  # 模型常驻内存，避免每次冷加载（6.9s→0s）
        "think": False,  # 禁用 gemma 思考模式，大幅加速 (~12x)
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.7,
        },
    }

    _log = logging.getLogger("lingjing.chat")
    _log.info(f"Ollama调用开始: model={model}, url={url}/api/chat, messages={len(ollama_messages)}")

    full_content = ""
    usage = {"input": 0, "output": 0}

    try:
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            async with client.stream(
                "POST",
                f"{url}/api/chat",
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    yield {"type": "error", "content": f"Ollama错误 ({resp.status_code}): {body.decode()[:200]}"}
                    return

                # Ollama 流式返回 NDJSON: 每行一个 JSON 对象
                # gemma4 等思考模型会先在 message.thinking 中输出思考过程，
                # 然后才在 message.content 中输出实际回复。我们只取 content。
                # 如果连续跳过过多空 content chunk（模型陷入思考循环），主动中断
                empty_skip_count = 0
                max_empty_skips = 200  # gemma4 思考模型最多跳过200个空token
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        is_done = data.get("done", False)

                        # 提取 usage（最后一个 chunk 会带这些字段）
                        if "eval_count" in data:
                            usage["output"] = data.get("eval_count", 0)
                        if "prompt_eval_count" in data:
                            usage["input"] = data.get("prompt_eval_count", 0)

                        # done 标记但无 content：结束
                        if is_done and not content:
                            break

                        # 跳过纯思考 token（有 thinking 但无 content 的 chunk）
                        if not content:
                            empty_skip_count += 1
                            if empty_skip_count >= max_empty_skips:
                                _log.warning(f"Ollama 连续 {max_empty_skips} 个空token，可能陷入思考循环，中断流")
                                yield {"type": "error", "content": "本地模型响应异常（思考循环），请简化问题重试"}
                                return
                            continue

                        full_content += content
                        empty_skip_count = 0  # 有实质内容时重置计数
                        yield {"type": "chunk", "content": content}

                        if is_done:
                            break
                    except json.JSONDecodeError:
                        continue

        if not full_content:
            yield {"type": "error", "content": "Ollama 返回空内容"}
            return

        # 粗略估算未获取到的 token
        if usage["output"] == 0:
            usage["output"] = len(full_content) // 2
        if usage["input"] == 0:
            usage["input"] = sum(len(m.get("content", "")) for m in messages) // 2

        yield {"type": "done", "content": full_content, "usage": usage}

    except httpx.TimeoutException:
        yield {"type": "error", "content": f"本地模型 ({model}) 响应超时 ({timeout}s)，模型首次加载可能需要更长时间"}
    except httpx.ConnectError:
        yield {"type": "error", "content": f"无法连接 Ollama ({url})，请确认 ollama serve 正在运行"}
    except Exception as e:
        yield {"type": "error", "content": f"Ollama 调用异常: {str(e)[:200]}"}


def estimate_cost(usage: dict, model: str | None = None) -> float:
    """估算本次调用费用（元），本地 Ollama 免费"""
    model = model or config.DEEPSEEK_MODEL
    # 本地模型免费
    if model == "ollama":
        return 0.0
    # DeepSeek V4 定价 (USD/1M tokens, 汇率约7.2)
    # deepseek-v4-flash: $0.14 input, $0.28 output
    # deepseek-v4-pro:   $0.435 input (75% off), $0.87 output (75% off)
    # deepseek-chat (旧/V3): $2.0 input, $8.0 output
    pricing = {
        "deepseek-v4-flash": {"input": 1.01, "output": 2.02},
        "deepseek-v4-pro":   {"input": 3.13, "output": 6.26},
        "deepseek-chat":     {"input": 14.4, "output": 57.6},
        "deepseek-reasoner": {"input": 14.4, "output": 57.6},
        "glm-4-flash":       {"input": 0.0, "output": 0.0},
    }
    prices = pricing.get(model, {"input": 2.0, "output": 4.0})
    cost = (usage.get("input", 0) * prices["input"] + usage.get("output", 0) * prices["output"]) / 1_000_000
    return round(cost, 6)
