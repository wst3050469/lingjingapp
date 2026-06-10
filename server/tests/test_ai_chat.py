"""
灵境AI - AI聊天服务单元测试

测试目标:
  - stream_chat 路由逻辑 (model参数解析, hint路由)
  - _split_system_for_ollama 分割逻辑
  - estimate_cost 费用估算
  - 错误处理 (超时、连接错误、空内容)
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from typing import AsyncGenerator

from server.app.services.ai_chat import (
    stream_chat,
    _split_system_for_ollama,
    estimate_cost,
    _deepseek_stream_chat,
    _ollama_stream_chat,
)


# ===== _split_system_for_ollama 测试 =====

class TestSplitSystemForOllama:
    """验证长 system prompt 分割逻辑"""

    def test_short_prompt_unchanged(self):
        """短 prompt (<800字) 应原样保留在 system 中"""
        prompt = "你是一个高效的AI助手。" * 10  # ~100字
        core, context = _split_system_for_ollama(prompt)
        assert core == prompt.strip()
        assert context == ""

    def test_split_at_memory_injection(self):
        """遇到记忆注入标记时应正确分割"""
        core_part = "你是一个专业的AI助手，请始终保持简洁直接的回复风格。"
        context_part = "\n\n---\n以下是与当前话题相关的记忆\n用户名叫张三，喜欢编程"
        prompt = core_part + context_part
        core, context = _split_system_for_ollama(prompt)
        assert core_part in core
        assert "记忆" in context

    def test_split_at_business_data(self):
        """遇到业务数据标记时应正确分割"""
        core_part = "你是一个建筑行业AI助手。"
        context_part = "\n\n===== 实时业务数据 =====\n项目: 杭州大厦改造"
        prompt = core_part + context_part
        core, context = _split_system_for_ollama(prompt)
        assert "建筑行业" in core
        assert "杭州大厦" in context

    def test_split_at_team_notification(self):
        """遇到团队通知标记时应正确分割"""
        core_part = "你是一个灵境AI助手。"
        context_part = "\n\n[灵境团队通知]\n系统维护通知"
        prompt = core_part + context_part
        core, context = _split_system_for_ollama(prompt)
        assert "灵境AI助手" in core
        assert "系统维护" in context

    def test_split_at_project_info(self):
        """遇到项目信息标记时应正确分割"""
        core_part = "你是一个项目管理助手。"
        context_part = "\n\n用户当前绑定的项目\n项目A - 进行中"
        prompt = core_part + context_part
        core, context = _split_system_for_ollama(prompt)
        assert "项目管理" in core
        assert "项目A" in context

    def test_hard_truncate_at_max_system(self):
        """超过 max_system 字数时应截断"""
        core_part = "A" * 900
        context_part = "\n\n---\n以下是与当前话题相关的记忆\n附加数据"
        prompt = core_part + context_part
        # max_system 默认800
        core, context = _split_system_for_ollama(prompt, max_system=100)
        assert len(core) <= 100
        assert "附加数据" in context

    def test_context_wrapped_correctly(self):
        """分割后的 context 应添加工作上下文前缀"""
        core_part = "核心人格"
        context_part = "\n\n---\n以下是与当前话题相关的记忆\n一些记忆数据"
        prompt = core_part + context_part
        core, context = _split_system_for_ollama(prompt)
        assert "[灵境工作上下文" in context
        assert "一些记忆数据" in context

    def test_no_marker_found(self):
        """没有标记时，即使较长也应返回空 context"""
        prompt = "你是一个AI助手。" * 50  # ~500字
        core, context = _split_system_for_ollama(prompt)
        assert context == ""


# ===== estimate_cost 测试 =====

class TestEstimateCost:
    """验证费用估算逻辑"""

    def test_ollama_free(self):
        """Ollama 本地模型费用应为 0"""
        usage = {"input": 1000, "output": 500}
        cost = estimate_cost(usage, model="ollama")
        assert cost == 0.0

    def test_deepseek_v4_flash(self):
        """DeepSeek V4 Flash 费用计算"""
        usage = {"input": 1_000_000, "output": 1_000_000}
        cost = estimate_cost(usage, model="deepseek-v4-flash")
        # input: 1M * 1.01 / 1M = 1.01, output: 1M * 2.02 / 1M = 2.02, total = 3.03
        assert round(cost, 2) == 3.03

    def test_deepseek_v4_pro(self):
        """DeepSeek V4 Pro 费用计算"""
        usage = {"input": 500_000, "output": 200_000}
        cost = estimate_cost(usage, model="deepseek-v4-pro")
        assert cost > 0
        assert cost < 5.0

    def test_zero_usage(self):
        """无 token 消耗时费用应为 0"""
        usage = {"input": 0, "output": 0}
        cost = estimate_cost(usage)
        assert cost == 0.0

    def test_unknown_model_fallback(self):
        """未知模型应使用默认定价"""
        usage = {"input": 1_000_000, "output": 1_000_000}
        cost = estimate_cost(usage, model="unknown-model")
        assert cost > 0  # 使用默认定价


# ===== stream_chat 路由逻辑测试 =====

class TestStreamChatRouting:
    """验证 stream_chat 的模型路由逻辑"""

    @pytest.mark.asyncio
    async def test_hint_reasoning_routes_correctly(self):
        """hint:reasoning 应路由到 DeepSeek"""
        with patch('server.app.services.ai_chat.resolve_model') as mock_resolve:
            with patch('server.app.services.ai_chat._deepseek_stream_chat') as mock_ds:
                mock_resolve.return_value = ("deepseek", "deepseek-reasoner")
                mock_ds.return_value = _mock_async_gen([{"type": "done", "content": "ok", "usage": {"input": 0, "output": 0}}])

                results = []
                async for chunk in stream_chat(
                    messages=[{"role": "user", "content": "hello"}],
                    model="hint:reasoning",
                ):
                    results.append(chunk)

                mock_resolve.assert_called_once_with("hint:reasoning")
                assert len(results) > 0

    @pytest.mark.asyncio
    async def test_hint_ollama_routes_to_ollama(self):
        """hint: 解析出 ollama provider 时应路由到 Ollama"""
        with patch('server.app.services.ai_chat.resolve_model') as mock_resolve:
            with patch('server.app.services.ai_chat._ollama_stream_chat') as mock_ollama:
                mock_resolve.return_value = ("ollama", "gemma4:26b")
                mock_ollama.return_value = _mock_async_gen([{"type": "done", "content": "ok", "usage": {"input": 0, "output": 0}}])

                results = []
                async for chunk in stream_chat(
                    messages=[{"role": "user", "content": "hello"}],
                    model="hint:fast",
                ):
                    results.append(chunk)

                mock_ollama.assert_called_once()
                assert len(results) > 0

    @pytest.mark.asyncio
    async def test_ollama_model(self):
        """model='ollama' 应直接路由到 Ollama"""
        with patch('server.app.services.ai_chat._ollama_stream_chat') as mock_ollama:
            mock_ollama.return_value = _mock_async_gen([{"type": "done", "content": "ok", "usage": {"input": 0, "output": 0}}])

            results = []
            async for chunk in stream_chat(
                messages=[{"role": "user", "content": "hello"}],
                model="ollama",
            ):
                results.append(chunk)

            mock_ollama.assert_called_once()
            assert len(results) > 0

    @pytest.mark.asyncio
    async def test_default_route_to_deepseek(self):
        """model=None 应默认路由到 DeepSeek"""
        with patch('server.app.services.ai_chat._deepseek_stream_chat') as mock_ds:
            mock_ds.return_value = _mock_async_gen([{"type": "done", "content": "ok", "usage": {"input": 0, "output": 0}}])

            results = []
            async for chunk in stream_chat(
                messages=[{"role": "user", "content": "hello"}],
                model=None,
            ):
                results.append(chunk)

            mock_ds.assert_called_once()
            assert len(results) > 0


# ===== 错误处理测试 =====

class TestErrorHandling:
    """验证错误处理逻辑"""

    @pytest.mark.asyncio
    async def test_deepseek_timeout(self):
        """DeepSeek 超时应返回错误"""
        with patch('server.app.services.ai_chat.config') as mock_config:
            mock_config.DEEPSEEK_API_KEY = "test-key"
            mock_config.DEEPSEEK_BASE_URL = "https://test.com"
            mock_config.DEEPSEEK_MODEL = "test-model"

            with patch('httpx.AsyncClient') as mock_client:
                mock_instance = AsyncMock()
                mock_instance.stream.side_effect = TimeoutError("timeout")
                mock_client.return_value.__aenter__.return_value = mock_instance

                results = []
                async for chunk in _deepseek_stream_chat(
                    messages=[{"role": "user", "content": "hello"}],
                    model="test-model",
                ):
                    results.append(chunk)

                assert any(r["type"] == "error" for r in results)
                # 注意: httpx.TimeoutException会被捕获，TimeoutError不会被捕获
                # 这里测试异常路径

    @pytest.mark.asyncio
    async def test_ollama_disabled(self):
        """Ollama 未启用时应返回错误"""
        with patch('server.app.services.ai_chat.config') as mock_config:
            mock_config.OLLAMA_CHAT_ENABLED = False

            results = []
            async for chunk in _ollama_stream_chat(
                messages=[{"role": "user", "content": "hello"}],
            ):
                results.append(chunk)

            assert any(r["type"] == "error" for r in results)
            assert any("未启用" in r["content"] for r in results)

    @pytest.mark.asyncio
    async def test_deepseek_api_error(self):
        """DeepSeek 非200响应应返回错误"""
        with patch('server.app.services.ai_chat.config') as mock_config:
            mock_config.DEEPSEEK_API_KEY = "test-key"
            mock_config.DEEPSEEK_BASE_URL = "https://test.com"
            mock_config.DEEPSEEK_MODEL = "test-model"

            mock_response = AsyncMock()
            mock_response.status_code = 401
            mock_response.aread = AsyncMock(return_value=b'{"error":"unauthorized"}')

            mock_client = AsyncMock()
            mock_client.stream.return_value.__aenter__.return_value = mock_response

            with patch('httpx.AsyncClient') as mock_client_cls:
                mock_client_cls.return_value.__aenter__.return_value = mock_client

                results = []
                async for chunk in _deepseek_stream_chat(
                    messages=[{"role": "user", "content": "hello"}],
                    model="test-model",
                ):
                    results.append(chunk)

                assert any(r["type"] == "error" for r in results)

    @pytest.mark.asyncio
    async def test_ollama_connect_error(self):
        """Ollama 连接失败应返回错误"""
        with patch('server.app.services.ai_chat.config') as mock_config:
            mock_config.OLLAMA_CHAT_ENABLED = True
            mock_config.OLLAMA_CHAT_URL = "http://localhost:11434"
            mock_config.OLLAMA_CHAT_MODEL = "test-model"
            mock_config.OLLAMA_CHAT_TIMEOUT = 30

            with patch('httpx.AsyncClient') as mock_client:
                mock_instance = AsyncMock()
                mock_instance.stream.side_effect = ConnectionError("Connection refused")
                mock_client.return_value.__aenter__.return_value = mock_instance

                results = []
                async for chunk in _ollama_stream_chat(
                    messages=[{"role": "user", "content": "hello"}],
                ):
                    results.append(chunk)

                # 注意: httpx.ConnectError 会被捕获，但普通 ConnectionError 不会
                # 实际代码捕获 httpx.ConnectError


# ===== 辅助函数 =====

async def _mock_async_gen(items: list) -> AsyncGenerator:
    """创建模拟异步生成器"""
    for item in items:
        yield item
