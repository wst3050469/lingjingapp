"""
灵境AI业务管家 - Web搜索服务
支持Bing搜索 + 网页内容抓取 + AI总结分析 + 竞品对比
"""
import re
import hashlib
import logging
import time
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from .token_compressor import compress

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("lingjing.web_search")

_search_cache: dict = {}
_CACHE_TTL = 3600

def _cache_key(query: str) -> str:
    return hashlib.md5(query.strip().lower().encode()).hexdigest()[:16]

async def _baidu_search(query: str, max_results: int = 5) -> list:
    """百度搜索（中文搜索效果最佳，备选保留）"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept": "text/html,*/*",
        }
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get("https://www.baidu.com/s",
                                    params={"wd": query, "rn": max_results}, headers=headers)
            resp.raise_for_status()
            html = resp.text
        soup = BeautifulSoup(html, "lxml")
        results = []
        for item in soup.select(".result, .result-op")[:max_results]:
            title_el = item.select_one("h3 a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title:
                continue
            snippet = ""
            snip_els = item.select(".c-abstract, .c-span-last, .content-right_2s-H4")
            if snip_els:
                snippet = " ".join(s.get_text(strip=True) for s in snip_els)
            results.append({
                "title": title[:200],
                "url": title_el.get("href", ""),
                "snippet": snippet[:500],
            })
        if results:
            logger.info(f"百度搜索 '{query[:50]}' -> {len(results)}条")
            return results
        return []
    except Exception as e:
        logger.debug(f"百度搜索失败: {e}")
        return []

async def _bing_search(query: str, max_results: int = 5) -> list:
    """Bing搜索（中国可用，稳定可靠）"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get("https://cn.bing.com/search",
                                    params={"q": query, "count": max_results}, headers=headers)
            resp.raise_for_status()
            html = resp.text
        soup = BeautifulSoup(html, "lxml")
        results = []
        for item in soup.select("li.b_algo")[:max_results]:
            title_el = item.select_one("h2 a")
            snip_el = item.select_one(".b_caption p, .b_lineclamp2")
            if not title_el:
                continue
            results.append({
                "title": title_el.get_text(strip=True)[:200],
                "url": title_el.get("href", ""),
                "snippet": snip_el.get_text(strip=True)[:500] if snip_el else "",
            })
        if results:
            logger.info(f"Bing搜索 '{query[:50]}' -> {len(results)}条")
            return results
        return []
    except Exception as e:
        logger.debug(f"Bing搜索失败: {e}")
        return []

async def _sogou_search(query: str, max_results: int = 5) -> list:
    """搜狗搜索（Bing 不可用时的中文备选）"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get("https://www.sogou.com/web",
                                    params={"query": query}, headers=headers)
            resp.raise_for_status()
            html = resp.text
        soup = BeautifulSoup(html, "lxml")
        results = []
        for item in soup.select(".vrwrap, .rb")[:max_results]:
            title_el = item.select_one("h3 a, .vr-title a")
            snip_el = item.select_one(".star-wiki, .str-text, .text-l")
            if not title_el:
                continue
            results.append({
                "title": title_el.get_text(strip=True)[:200],
                "url": title_el.get("href", ""),
                "snippet": snip_el.get_text(strip=True)[:500] if snip_el else "",
            })
        if results:
            logger.info(f"搜狗搜索 '{query[:50]}' -> {len(results)}条")
            return results
        return []
    except Exception as e:
        logger.debug(f"搜狗搜索失败: {e}")
        return []


async def _search(query: str, max_results: int = 5) -> list:
    """统一搜索入口：Bing → 百度 → 搜狗 级联降级"""
    for engine_name, engine_fn in [("Bing", _bing_search), ("百度", _baidu_search), ("搜狗", _sogou_search)]:
        results = await engine_fn(query, max_results)
        if results:
            return results
        logger.info(f"{engine_name}搜索无结果，尝试下一引擎")
    return []


async def _fetch_baike_text(url: str, timeout: float = 8.0) -> str:
    """专门处理百度百科的文本提取（使用API接口绕过403）"""
    try:
        # 从URL提取词条名
        match = re.search(r'item/([^/?#]+)', url)
        if not match:
            return ""
        item_name = match.group(1)
        # 使用百度百科的开放API
        api_url = f"https://baike.baidu.com/api/lemma?lemma_id=&lemma_title={item_name}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://baike.baidu.com/",
            "Accept": "application/json, text/plain, */*",
        }
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(api_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                # 提取摘要和段落内容
                parts = []
                if data.get("lemmaSummary"):
                    parts.append(data["lemmaSummary"])
                if data.get("abstract"):
                    parts.append(data["abstract"])
                for section in data.get("sections", []):
                    if section.get("content"):
                        parts.append(section["content"])
                text = "\n".join(parts)
                if text:
                    return text[:3000]
        # API失败，尝试移动版页面
        mobile_url = f"https://baike.baidu.com/item/{item_name}"
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(mobile_url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")
                for tag in soup(["script", "style", "nav", "footer"]):
                    tag.decompose()
                text = soup.get_text(separator="\n", strip=True)
                lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 5]
                return "\n".join(lines)[:3000]
    except Exception as e:
        logger.debug(f"百度百科API提取失败: {e}")
    return ""


async def _fetch_page_text(url: str, timeout: float = 8.0) -> str:
    try:
        # 百度百科特殊处理（绕过403限制）
        if "baike.baidu.com" in url:
            baike_text = await _fetch_baike_text(url, timeout)
            if baike_text:
                return baike_text

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,*/*", "Accept-Language": "zh-CN,zh;q=0.9",
        }
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            logger.warning(f"403禁止访问: {url[:80]}，尝试文本化服务降级")
            # 使用 textise.iitty 作为备选
            try:
                textise_url = f"https://r.jina.ai/http://{url.split('://')[1]}" if "://" in url else url
                textise_headers = {"Accept": "text/plain", "User-Agent": "Mozilla/5.0"}
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client2:
                    resp2 = await client2.get(textise_url, headers=textise_headers)
                    if resp2.status_code == 200 and len(resp2.text) > 100:
                        return resp2.text[:3000]
            except Exception:
                pass
            return f"[该网页因访问限制无法获取详细内容，请直接访问查看: {url}]"
        logger.warning(f"获取网页内容失败: {url[:80]} (HTTP {e.response.status_code})")
        return ""
    except Exception:
        logger.warning(f"获取网页内容失败: {url[:80]}", exc_info=True)
        return ""
    try:
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script","style","nav","footer","header","aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        return "\n".join(lines)[:3000]
    except Exception:
        logger.warning("BeautifulSoup解析失败，使用正则降级", exc_info=True)
        text = re.sub(r'<[^>]+>', ' ', html)
        return re.sub(r'\s+', ' ', text).strip()[:2000]

async def _call_deepseek(system_prompt: str, user_prompt: str, max_tokens: int = 800) -> str:
    """调用DeepSeek AI进行文本分析"""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                json={"model": DEEPSEEK_MODEL, "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}],
                    "max_tokens": max_tokens, "temperature": 0.3})
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"DeepSeek API调用失败: {e}")
        raise

async def _ai_summarize(query: str, search_results: list, page_texts: list) -> str:
    if not search_results:
        return ""
    context_parts = [f"用户查询: {query}\n\n===== 搜索结果 ====="]
    for i, r in enumerate(search_results, 1):
        context_parts.append(f"[{i}] {r['title']}\n    {r['snippet']}")
    if any(page_texts):
        context_parts.append("\n===== 网页详细内容 =====")
        for i, (r, pt) in enumerate(zip(search_results, page_texts), 1):
            if pt:
                # 压缩网页文本：去重空白、截断冗余，减少token消耗
                compressed = compress(pt, strategy="smart", max_tokens=800)
                context_parts.append(f"--- [{i}] {r['title']} ---\n{compressed[:1500]}")
    context = "\n".join(context_parts)
    prompt = f"""你是灵境的搜索分析助手。根据以下搜索结果，对用户的问题进行总结分析。

{context}

要求：
1. 如含价格、参数等数据，用表格或对比列表呈现
2. 标注信息来源（第几条结果）
3. 信息不足时诚实说明
4. 整体控制在300字以内
5. 结尾标注"以上信息来自网络搜索，仅供参考"

请直接给出分析结果："""
    try:
        result = await _call_deepseek("你是灵境的搜索分析助手。", prompt, max_tokens=800)
        logger.info(f"AI分析完成 {len(result)}字")
        return result
    except Exception as e:
        logger.warning(f"AI分析失败: {e}")
        parts = [f"**{query}** 搜索结果：\n"]
        for i, r in enumerate(search_results[:5], 1):
            parts.append(f"{i}. **{r['title']}**\n   {r['snippet']}\n")
        parts.append("\n(AI分析暂不可用)")
        return "\n".join(parts)

_SEARCH_KEYWORDS = [
    "搜索","搜一下","查一下","帮我查","帮我搜","网上查","找一下","搜搜","查查",
    "了解一下","有没有人","市场上","行情","市价","竞品","竞争对手","同行","别人卖多少",
    "现在什么价","最新","标准规范","行业标准","国标","政策","规定","要求"
]

_SEARCH_PATTERNS = [
    r"(?:帮[我]?|给我|替我)(?:搜|查|找|了解|看看)[一一下]?(?:搜索|网上|网络|一下|看看)",
    r"(?:网上|网络|在线)(?:搜|查|找)[一一下]?",
    r"(?:查|搜|找)[一一下]?(?:看|看看)?(?:现在|最新|目前|当前).{0,10}(?:价格|多少钱|报价|行情)",
    r"(?:和|与|跟|对比?).{0,6}(?:竞品|竞争对手|同行|对手).{0,6}(?:对比|比较|有什么区别|差在哪)",
    r"(?:产品|东西|服务).{0,6}(?:价格|对比|比较|怎么样)",
    r"看看.{0,6}(?:别人|同行|市场|网上).{0,6}(?:怎么|如何|什么)",
    r"(?:查|搜|找).{0,4}(?:标准|规范|国标|政策|法规|规定)",
    r"(?:最近|现在|目前).{0,10}(?:行情|市场|价格|趋势|情况)",
    r"(?:搜索|搜|查).{0,4}(?:一下|看看|给我)",
]

def detect_search_intent(message: str) -> bool:
    msg = message.strip().lower()
    for kw in _SEARCH_KEYWORDS:
        if kw in msg:
            return True
    for pat in _SEARCH_PATTERNS:
        if re.search(pat, msg):
            return True
    return False

def extract_search_query(message: str) -> str | None:
    msg = message.strip()
    cleaned = re.sub(r'^[帮给替]我?', '', msg)
    cleaned = re.sub(r'(?:一下|一哈|看看|看下|帮我|给我|替我)', ' ', cleaned)
    cleaned = re.sub(r'(?:搜索|搜|查)[一一下]?(?:看|看看)?', ' ', cleaned)
    cleaned = re.sub(r'(?:网上|网络|在线)', ' ', cleaned)
    cleaned = re.sub(r'^(?:看|看看|看看看)\s*', '', cleaned)
    cleaned = cleaned.strip().rstrip('?？!！。.')
    cleaned = re.sub(r'[啊吧呢吗]$', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    if len(cleaned) < 2:
        return None
    return cleaned

async def search_and_analyze(message: str, tenant_id: str = None) -> str:
    key = _cache_key(message)
    if key in _search_cache and time.time() - _search_cache[key].get("ts",0) < _CACHE_TTL:
        logger.info(f"命中缓存: {message[:30]}")
        return _search_cache[key]["result"]
    query = extract_search_query(message)
    if not query:
        return ""
    start = time.time()
    raw_results = await _search(query, max_results=5)
    if not raw_results:
        result = "网络搜索未找到相关结果，请尝试更具体的关键词。"
        _search_cache[key] = {"ts": time.time(), "result": result}
        return result
    urls = [r["url"] for r in raw_results[:3] if r.get("url")]
    page_texts = []
    if urls:
        try:
            page_texts = await asyncio.wait_for(
                asyncio.gather(*[_fetch_page_text(url) for url in urls], return_exceptions=True),
                timeout=10.0)
            page_texts = [pt if isinstance(pt, str) else "" for pt in page_texts]
        except asyncio.TimeoutError:
            page_texts = [""] * len(urls)
    result = await _ai_summarize(query, raw_results, page_texts)
    elapsed = time.time() - start
    result += f"\n\n*(搜索耗时 {elapsed:.1f}s，来源：Bing)*"
    _search_cache[key] = {"ts": time.time(), "result": result}
    return result

async def competitive_analysis(message: str, tenant_id: str = None) -> str:
    key = _cache_key(f"competitive:{message}")
    if key in _search_cache and time.time() - _search_cache[key].get("ts",0) < _CACHE_TTL:
        return _search_cache[key]["result"]
    query = extract_search_query(message)
    if not query:
        return ""
    start = time.time()
    self_r, comp_r = await asyncio.gather(
        _search(f"{query} 价格 报价", max_results=3),
        _search(f"{query} 竞品 对比 替代", max_results=3))
    if not self_r and not comp_r:
        result = "未找到相关产品和竞品信息。"
        _search_cache[key] = {"ts": time.time(), "result": result}
        return result
    ctx = [f"用户想了解: {query}"]
    if self_r:
        ctx.append("\n===== 产品自身信息 =====")
        for i, r in enumerate(self_r, 1):
            snippet = compress(r.get('snippet', ''), strategy="smart", max_tokens=200)
            ctx.append(f"[S{i}] {r['title']}: {snippet}")
    if comp_r:
        ctx.append("\n===== 竞品/替代方案 =====")
        for i, r in enumerate(comp_r, 1):
            snippet = compress(r.get('snippet', ''), strategy="smart", max_tokens=200)
            ctx.append(f"[C{i}] {r['title']}: {snippet}")
    context = "\n".join(ctx)
    prompt = f"""你是灵境的竞品分析助手。根据搜索结果，帮用户分析产品及竞品情况。

{context}

要求：
1. 先列产品自身信息（价格区间、主要特点）
2. 再列竞品/替代方案信息
3. 做简单对比：价格、特点、适用场景
4. 用表格或列表形式呈现对比
5. 结论控制在2-3句话
6. 如信息不足，诚实说明并给出建议的搜索方向
7. 结尾标注"以上信息来自网络搜索，仅供参考"

请直接给出分析报告："""
    try:
        result = await _call_deepseek("你是灵境的竞品分析助手。简洁、客观。", prompt, max_tokens=1000)
    except Exception as e:
        logger.warning(f"竞品AI分析失败: {e}")
        result = f"**{query} 竞品对比搜索完成**\n"
        if self_r:
            result += "\n📦 产品信息:\n" + "\n".join(f"- {r['title']}: {r['snippet'][:100]}" for r in self_r[:3])
        if comp_r:
            result += "\n\n🏪 竞品信息:\n" + "\n".join(f"- {r['title']}: {r['snippet'][:100]}" for r in comp_r[:3])
        result += "\n\n(AI分析暂不可用)"
    elapsed = time.time() - start
    result += f"\n\n*(竞品分析耗时 {elapsed:.1f}s，来源：Bing)*"
    _search_cache[key] = {"ts": time.time(), "result": result}
    return result
