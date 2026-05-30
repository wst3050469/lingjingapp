"""
灵境 - 语音实时转写 WebSocket 端点

端点:
  WS /api/v1/asr/stream?token=<token>
    客户端 → 服务器: binary PCM chunks (16kHz, 16bit, mono)
    服务器 → 客户端: JSON {"type":"interim","text":"..."} 或 {"type":"final","text":"..."}

工作流:
  1. 接收线程持续累积音频到缓冲区
  2. 后台任务每 ~1s 做一次 interim 转写（不阻塞接收）
  3. 客户端断开时，做最终全量转写

注意事项:
  - 输入必须是 16kHz 16bit 单声道 PCM 裸流
  - 单次连接最大音频 60s（超过自动截断保留最近 30s）
  - 最大并发连接数 5 路（防 GPU 过载）
"""
import os
import sys
import logging
import time
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from urllib.parse import parse_qs

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.transcribe import StreamingTranscriber

logger = logging.getLogger("lingjing.voice_asr")

router = APIRouter(prefix="/api/v1/asr")

_MAX_CONCURRENT = 5
_active_sessions: set[str] = set()


def _can_accept() -> bool:
    return len(_active_sessions) < _MAX_CONCURRENT


async def _verify_token(token: str) -> dict | None:
    """从 token 获取用户信息"""
    import db as database
    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT code, nickname FROM invite_codes WHERE token=$1 AND status='active'",
                token,
            )
            if row:
                return {"user_id": row["code"], "nickname": row["nickname"] or row["code"]}
            row = await conn.fetchrow(
                "SELECT u.username FROM users u WHERE u.token=$1 AND u.status='active'",
                token,
            )
            if row:
                return {"user_id": row["username"], "nickname": row["username"]}
    except Exception as e:
        logger.error(f"ASR token 验证异常: {e}")
    return None


@router.websocket("/stream")
async def asr_stream(websocket: WebSocket):
    """WebSocket 流式语音转写端点"""
    query_string = websocket.scope.get("query_string", b"").decode("utf-8")
    params = parse_qs(query_string)
    token = params.get("token", [None])[0]

    if not token:
        await websocket.accept()
        await websocket.send_json({"type": "error", "code": "no_token", "message": "缺少 token 参数"})
        await websocket.close(code=4001)
        return

    user = await _verify_token(token)
    if not user:
        await websocket.accept()
        await websocket.send_json({"type": "error", "code": "invalid_token", "message": "Token 无效或已过期"})
        await websocket.close(code=4001)
        return

    await websocket.accept()

    session_id = f"asr_{user['user_id']}_{int(time.time())}"
    if not _can_accept():
        logger.warning(f"ASR 并发已达上限 ({_MAX_CONCURRENT})，拒绝连接 {session_id}")
        await websocket.send_json({"type": "error", "code": "busy", "message": f"服务器繁忙，当前 ASR 并发已达上限 ({_MAX_CONCURRENT}路)"})
        await websocket.close(code=1013)
        return

    _active_sessions.add(session_id)
    logger.info(f"ASR 流式连接已建立: {session_id} (活跃: {len(_active_sessions)})")

    transcriber = StreamingTranscriber()
    total_bytes = 0
    pcm_count = 0
    client_finished = False
    error_occurred = False

    interim_queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _interim_worker():
        """后台转写任务：VAD加速版 - 检测到语音才触发GPU推理"""
        skip_count = 0
        sentinel_count = 0
        while not client_finished and not error_occurred:
            await asyncio.sleep(1.0)  # 1s间隔→实时性更好
            if client_finished or error_occurred:
                break
            try:
                text = await transcriber.transcribe_interim()
                if text:
                    await interim_queue.put(text)
                    skip_count = 0
                    sentinel_count = 0
                else:
                    skip_count += 1
                    sentinel_count += 1
                    # 连续5次VAD跳过后让出事件循环
                    if skip_count > 5:
                        await asyncio.sleep(0)
                        skip_count = 0
                    # 连续10次无结果（约10秒静音）→ 提前结束
                    if sentinel_count >= 10 and not transcriber.is_empty:
                        logger.info(f"ASR连续10次无结果，提前结束")
                        break
            except Exception as e:
                logger.debug(f"Interim worker 异常: {e}")

    interim_task = asyncio.create_task(_interim_worker())

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=60.0)
            except asyncio.TimeoutError:
                logger.info(f"ASR 流接收超时 ({session_id})，自动结束")
                break

            msg_type = message.get("type", "")

            if msg_type == "websocket.disconnect":
                logger.info(f"ASR 客户端主动断开: {session_id}")
                break

            if msg_type == "websocket.receive":
                data = message.get("bytes")
                if data is not None:
                    total_bytes += len(data)
                    pcm_count += 1
                    await transcriber.add_chunk(data)
                else:
                    text_data = message.get("text", "")
                    if text_data == "__END__":
                        break
                    elif text_data == "__ABORT__":
                        error_occurred = True
                        break

            while not interim_queue.empty():
                try:
                    interim_text = interim_queue.get_nowait()
                    await websocket.send_json({
                        "type": "interim",
                        "text": interim_text,
                    })
                except asyncio.QueueEmpty:
                    break

    except WebSocketDisconnect:
        logger.info(f"ASR WebSocket 断开: {session_id}")
    except Exception as e:
        logger.error(f"ASR 流异常 [{session_id}]: {e}", exc_info=True)
        error_occurred = True
        try:
            await websocket.send_json({"type": "error", "code": "internal", "message": f"服务器内部错误: {str(e)[:50]}"})
        except Exception:
            pass
    finally:
        client_finished = True
        interim_task.cancel()
        try:
            await interim_task
        except asyncio.CancelledError:
            pass

        _active_sessions.discard(session_id)
        logger.info(f"ASR 流连接释放: {session_id} (活跃: {len(_active_sessions)}, 总音频: {total_bytes} bytes, {pcm_count} 帧)")

        if not error_occurred and not transcriber.is_empty:
            try:
                final_text = await transcriber.finalize()
                if final_text:
                    await websocket.send_json({
                        "type": "final",
                        "text": final_text,
                        "duration_sec": round(transcriber.buffer_duration_sec, 1),
                    })
                    logger.info(f"ASR 最终结果已发送: {session_id} -> {repr(final_text[:60])}")
            except Exception as e:
                logger.error(f"ASR finalize 失败 [{session_id}]: {e}")

        try:
            await websocket.close()
        except Exception:
            pass
