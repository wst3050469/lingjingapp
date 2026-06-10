"""
灵境平台 - WebSocket 推送端点
通过 main.py @app.websocket("/api/v1/ws/{token}") 注册
"""
import sys
import os
import asyncio as aio
import logging

from fastapi import WebSocket, WebSocketDisconnect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from services.ws_manager import ConnectionManager

logger = logging.getLogger("lingjing.ws")


async def _verify_token(token: str) -> dict | None:
    """从 token 获取用户信息（双表查找）"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT code, nickname FROM invite_codes WHERE token=$1 AND status='active'",
            token,
        )
        if row:
            return {"user_id": row["code"], "nickname": row["nickname"]}

        row = await conn.fetchrow(
            "SELECT u.username FROM users u WHERE u.token=$1 AND u.status='active'",
            token,
        )
        if row:
            return {"user_id": row["username"], "nickname": row["username"]}
    return None


async def handle_ws(websocket: WebSocket, token: str):
    """WebSocket 连接处理函数"""
    user = await _verify_token(token)
    if not user:
        await websocket.close(code=4001, reason="Token 无效或已过期")
        return

    user_id = user["user_id"]

    await websocket.accept()
    cid = await ConnectionManager.connect(user_id, websocket)

    try:
        while True:
            try:
                msg = await aio.wait_for(websocket.receive_text(), timeout=60)
                if msg == "ping":
                    try:
                        await websocket.send_json({"type": "pong"})
                    except Exception:
                        logger.warning("WS ping 发送失败", exc_info=True)
                        pass
            except aio.TimeoutError:
                logger.info(f"WS 超时: {user_id}#{cid}")
                break
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WS 异常 {user_id}#{cid}: {e}")
                break
    except Exception as e:
        logger.warning(f"WS 错误 {user_id}#{cid}: {e}")
    finally:
        await ConnectionManager.disconnect(user_id, websocket)
