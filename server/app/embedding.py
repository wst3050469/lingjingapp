"""灵境平台 - Embedding服务 (双节点负载均衡)"""
import asyncio
import httpx
import logging
import config

logger = logging.getLogger("lingjing.embedding")

_semaphore = asyncio.Semaphore(config.EMBED_MAX_CONCURRENT)
_client: httpx.AsyncClient | None = None
_use_secondary = False  # 主节点故障时切换到备节点


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


def _get_ollama_url() -> str:
    return config.OLLAMA_SECONDARY if _use_secondary else config.OLLAMA_PRIMARY


async def get_embedding(text: str) -> list[float]:
    global _use_secondary
    async with _semaphore:
        try:
            resp = await _get_client().post(
                f"{config.OLLAMA_PRIMARY}/api/embeddings",
                json={"model": config.EMBED_MODEL, "prompt": text[:8000]},
            )
            resp.raise_for_status()
            _use_secondary = False
            return resp.json()["embedding"]
        except Exception:
            logger.warning("主节点embedding失败，切换备节点", exc_info=True)
            # 主节点失败，尝试备节点
            try:
                resp = await _get_client().post(
                    f"{config.OLLAMA_SECONDARY}/api/embeddings",
                    json={"model": config.EMBED_MODEL, "prompt": text[:8000]},
                )
                resp.raise_for_status()
                _use_secondary = True
                return resp.json()["embedding"]
            except Exception:
                raise


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    tasks = [get_embedding(t) for t in texts]
    return await asyncio.gather(*tasks)


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def check_ollama_health() -> dict:
    """检查双节点 Ollama 健康状态"""
    result = {"primary": {"status": "error"}, "secondary": {"status": "error"}}
    client = _get_client()
    for label, url in [("primary", config.OLLAMA_PRIMARY), ("secondary", config.OLLAMA_SECONDARY)]:
        try:
            r = await client.get(f"{url}/api/tags", timeout=5.0)
            if r.status_code == 200:
                models = [m["name"] for m in r.json().get("models", [])]
                result[label] = {"status": "ok", "url": url, "models": models}
        except Exception as e:
            result[label] = {"status": "error", "url": url, "error": str(e)}
    return result
