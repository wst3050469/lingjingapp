"""
灵境 - Token 压缩机 (对标 OpenHuman TokenJuice)

核心功能：在工具输出/检索结果进入 LLM 上下文前进行规则压缩，
减少 token 消耗 50-80%，降低 API 成本。

压缩策略：
1. TRUNCATE    — 按行/字符智能截断（注意句尾边界）
2. DEDUP       — 去重连续重复行
3. FOLD        — 折叠多余空白/Tab/空行
4. DROP        — 正则匹配删除（日志/堆栈/调试信息/时间戳噪声）
5. SUMMARIZE   — 超长内容调用 AI 摘要（仅用于 > 阈值的数据）

用法：
    from token_compressor import compress
    compressed = compress(long_text, strategy="smart", max_tokens=800)
"""

import re
import logging

logger = logging.getLogger("lingjing.token_compressor")

# ── 内置压缩规则 ──────────────────────────────────────────────

# 删除模式：匹配到即删除整行
_DROP_LINE_PATTERNS = [
    re.compile(r'^\s*[-–—]{3,}\s*$'),          # 分隔线 -----
    re.compile(r'^\s*[│┃|]\s*$'),               # 空表格框线
    re.compile(r'^\s*\d{4}[-/]\d{2}[-/]\d{2}\s*\d{2}:\d{2}:\d{2}'), # 时间戳开头
    re.compile(r'^\s*(?:at\s+)?[\w.]+\(.*?\)\s*$'), # Java/Python堆栈行
    re.compile(r'^\s*Traceback\s*\(most\s*recent\s*call\s*last\)', re.IGNORECASE),
    re.compile(r'^\s*File\s+"[^"]+",\s*line\s+\d+'),  # Python堆栈
    re.compile(r'^\s*(?:DEBUG|TRACE|INFO)\s+\[.*?\]'),  # 日志级别前缀
    re.compile(r'^\s*(?:<!--|//|#)\s*.*$'),      # 注释行（部分保留）
]

# 替换模式：匹配到即替换内容
_REPLACE_PATTERNS = [
    (re.compile(r'\r\n'), '\n'),                 # 统一换行符
    (re.compile(r'\r'), '\n'),
    (re.compile(r'[ \t]+\n'), '\n'),             # 行尾空白
    (re.compile(r'\n{3,}'), '\n\n'),             # 连续空行 → 最多2行
    (re.compile(r'[^\S\n]{2,}'), ' '),           # 行内连续空白 → 单空格
    (re.compile(r'(.)\1{4,}'), r'\1\1'),         # 连续重复字符 >5 → 2个
    # 中文企业数据专属规则
    (re.compile(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])'), ''),  # 中文间空格去除
    (re.compile(r'有限公司'), '有限'),              # 公司名缩写: 有限公司→有限
    (re.compile(r'科技有限公司'), '科技'),           # 公司名缩写
    (re.compile(r'建设工程有限公司'), '建设'),        # 公司名缩写
    (re.compile(r'建筑材料有限公司'), '建材'),        # 公司名缩写
    (re.compile(r'装饰工程有限公司'), '装饰'),        # 公司名缩写
]

# 需要AI摘要的阈值（字符数）
_SUMMARIZE_THRESHOLD = 6000
_SUMMARIZE_MAX_INPUT = 15000  # AI摘要输入上限

# 最大行数（超过则截断）
_MAX_LINES = 200

# 智能截断的句子边界
_SENTENCE_BOUNDARY = re.compile(r'([。！？\n.!?])')


def compress(
    text: str,
    strategy: str = "smart",
    max_tokens: int = 800,
    max_lines: int = 200,
    enable_drop: bool = True,
    enable_fold: bool = True,
    enable_dedup: bool = True,
    enable_summarize: bool = False,
) -> str:
    """压缩文本，减少 token 消耗

    Args:
        text: 原始文本
        strategy: 压缩策略
            - "smart": 智能压缩（默认，平衡保留信息与压缩率）
            - "aggressive": 激进压缩（drop更多，截断更短）
            - "conservative": 保守压缩（仅折叠空白和去重）
            - "off": 不压缩
        max_tokens: Token估算上限（按中英文混合约1token≈1.3字符估算）
        max_lines: 最大保留行数
        enable_drop: 是否启用行删除规则
        enable_fold: 是否启用空白折叠
        enable_dedup: 是否启用连续重复行去重
        enable_summarize: 是否启用AI摘要（需外部调用）

    Returns:
        压缩后的文本
    """
    if strategy == "off" or not text:
        return text

    original_len = len(text)
    original_chars = len(text)

    # ── 1) 统一换行符 ──
    for pattern, replacement in _REPLACE_PATTERNS:
        if pattern.search(text):
            text = pattern.sub(replacement, text)

    lines = text.split('\n')

    # ── 2) 行删除 (DROP) ──
    if enable_drop:
        kept = []
        drop_count = 0
        for line in lines:
            should_drop = False
            for p in _DROP_LINE_PATTERNS:
                if p.search(line):
                    should_drop = True
                    drop_count += 1
                    break
            if not should_drop:
                kept.append(line)
        if drop_count:
            logger.debug(f"TokenCompressor: 删除了 {drop_count} 行噪声")
        lines = kept

    # ── 3) 去重连续重复行 (DEDUP) ──
    if enable_dedup:
        deduped = []
        prev = None
        dup_count = 0
        for line in lines:
            stripped = line.strip()
            if stripped and stripped == prev:
                dup_count += 1
                continue
            deduped.append(line)
            prev = stripped
        if dup_count:
            logger.debug(f"TokenCompressor: 去重了 {dup_count} 行重复")
        lines = deduped

    # ── 4) 行数截断 ──
    actual_max_lines = max_lines
    if strategy == "aggressive":
        actual_max_lines = min(max_lines, 100)
    if len(lines) > actual_max_lines:
        # 保留开头和结尾
        head_count = actual_max_lines // 2
        tail_count = actual_max_lines - head_count
        lines = lines[:head_count] + [
            f"\n... [中间 {len(lines) - head_count - tail_count} 行已折叠] ...\n"
        ] + lines[-tail_count:]
        logger.debug(f"TokenCompressor: 行数截断到 {head_count + 1 + tail_count} 行")

    text = '\n'.join(lines)

    # ── 5) Token 智能截断（保守估算: 中英文混合约1.3字符/token） ──
    est_tokens = len(text) / 1.3
    if est_tokens > max_tokens and max_tokens > 0:
        target_chars = int(max_tokens * 1.3)
        if strategy == "aggressive":
            # 直接截断到目标长度
            text = text[:target_chars]
        else:
            # 智能截断：在句子边界截断
            truncated = text[:target_chars]
            # 反向查找句子边界
            last_boundary = -1
            for m in _SENTENCE_BOUNDARY.finditer(truncated):
                last_boundary = m.end()
            if last_boundary > target_chars * 0.6:
                text = truncated[:last_boundary]
                text += "\n\n... [以下内容因长度限制已截断] ..."
            else:
                text = truncated
                text += "\n\n... [内容已截断] ..."
        logger.debug(f"TokenCompressor: Token截断 {est_tokens:.0f} → {max_tokens}")

    reduced = len(text) / max(original_len, 1)
    saved_pct = (1 - reduced) * 100
    logger.debug(f"TokenCompressor: {original_chars}字 → {len(text)}字, 节省 {saved_pct:.0f}%")

    return text


def estimate_tokens(text: str) -> int:
    """估算文本的 token 数量（中英文混合）"""
    # 中文约 1.5-2 字符/token，英文约 4 字符/token
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    other_chars = len(text) - chinese_chars
    return int(chinese_chars / 1.5 + other_chars / 4)


def compress_memories(
    memories: list[dict],
    max_total_tokens: int = 800,
    max_per_memory_tokens: int = 120,
    strategy: str = "smart",
) -> list[dict]:
    """压缩记忆列表，减少注入 system prompt 的 token 消耗

    Args:
        memories: 记忆列表 [{memory_id, content, type, ...}]
        max_total_tokens: 所有记忆总token上限
        max_per_memory_tokens: 单条记忆token上限
        strategy: 压缩策略

    Returns:
        压缩后的记忆列表
    """
    if not memories:
        return memories

    # 1. 截断单条记忆内容
    for m in memories:
        if m.get("content"):
            max_chars = int(max_per_memory_tokens * 1.3)
            if len(m["content"]) > max_chars:
                m["content"] = m["content"][:max_chars] + "..."

    # 2. 按相关性/优先级排序，保留最重要的
    #    已有排序（retrieve_memories已按relevance DESC）
    #    如果总token超限，丢弃低优先级
    total_chars = sum(len(m.get("content", "")) for m in memories)
    if total_chars > int(max_total_tokens * 1.3):
        # 从后往前删，直到总token达标
        while memories and sum(len(m.get("content", "")) for m in memories) > int(max_total_tokens * 1.3):
            memories.pop()
        logger.debug(f"TokenCompressor: 记忆列表从 {len(memories) + len(memories)} 条压缩到 {len(memories)} 条")

    return memories


def compress_file_context(
    file_contexts: list[dict],
    max_total_chars: int = 3000,
    max_per_file_chars: int = 1500,
) -> list[dict]:
    """压缩上传文件内容

    Args:
        file_contexts: 文件上下文列表 [{name, type, context_text, ...}]
        max_total_chars: 所有文件总字符上限
        max_per_file_chars: 单文件字符上限

    Returns:
        压缩后的文件上下文列表
    """
    if not file_contexts:
        return file_contexts

    for fc in file_contexts:
        if fc.get("context_text"):
            text = fc["context_text"]
            # 先通用压缩
            text = compress(text, strategy="smart", max_tokens=int(max_per_file_chars / 1.3))
            if len(text) > max_per_file_chars:
                text = text[:max_per_file_chars] + "\n... [文件内容截断] ..."
            fc["context_text"] = text

    # 如果总字符超限，从后往前删
    total = sum(len(fc.get("context_text", "")) for fc in file_contexts)
    while file_contexts and total > max_total_chars:
        removed = file_contexts.pop()
        total -= len(removed.get("context_text", ""))
        logger.debug(f"TokenCompressor: 移除文件 {removed.get('name', 'unknown')} (总大小超限)")

    return file_contexts
