"""
灵境平台 - WebSocket 连接管理器
维护 {user_id: [WebSocket, ...]} 连接池，支持多设备同时在线
"""
import logging
import time
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger("lingjing.ws")

# 全局连接池: user_id -> [WebSocket, ...]
_connections: dict[str, list[WebSocket]] = {}
_conn_counter = 0


def _next_cid() -> str:
    global _conn_counter
    _conn_counter += 1
    return f"c{_conn_counter}"


class ConnectionManager:
    """WebSocket 连接管理器（全局单例），支持多设备"""

    @staticmethod
    async def connect(user_id: str, ws: WebSocket) -> str:
        """注册新连接，返回连接ID。多设备并存"""
        cid = _next_cid()
        ws._lj_cid = cid
        ws._lj_uid = user_id

        if user_id not in _connections:
            _connections[user_id] = []
        _connections[user_id].append(ws)

        total = sum(len(v) for v in _connections.values())
        logger.info(f"WS 连接: {user_id}#{cid} (用户: {len(_connections)}, 连接: {total})")

        try:
            await ws.send_json({
                "type": "connected",
                "user_id": user_id,
                "cid": cid,
                "ts": time.time(),
            })
        except Exception:
            logger.warning(f"WS连接失败: user={user_id}", exc_info=True)
            pass
        return cid

    @staticmethod
    async def disconnect(user_id: str, ws: WebSocket):
        """移除指定连接"""
        cid = getattr(ws, '_lj_cid', '?')
        socks = _connections.get(user_id)
        if socks and ws in socks:
            socks.remove(ws)
            if not socks:
                del _connections[user_id]
        total = sum(len(v) for v in _connections.values())
        logger.info(f"WS 断开: {user_id}#{cid} (用户: {len(_connections)}, 连接: {total})")
        try:
            await ws.close()
        except RuntimeError:
            # 客户端已主动断开，WebSocket 已处于关闭状态
            # RuntimeError: Unexpected ASMI message 'websocket.close'
            logger.debug(f"WS 已关闭: {user_id}#{cid}")
        except Exception:
            logger.warning(f"WS 关闭异常: user={user_id}", exc_info=True)

    @staticmethod
    async def send_json(user_id: str, data: dict) -> bool:
        """向指定用户所有设备推送"""
        socks = _connections.get(user_id, [])
        if not socks:
            return False
        ok = False
        dead = []
        for ws in list(socks):
            try:
                await ws.send_json(data)
                ok = True
            except Exception:
                logger.warning("WS send_json 失败，标记断开", exc_info=True)
                dead.append(ws)
        for ws in dead:
            socks.remove(ws)
        if not socks:
            _connections.pop(user_id, None)
        return ok

    @staticmethod
    async def send_to_users(user_ids: list[str], data: dict) -> int:
        ok = 0
        for uid in user_ids:
            if await ConnectionManager.send_json(uid, data):
                ok += 1
        return ok

    @staticmethod
    async def broadcast(data: dict, exclude: Optional[str] = None) -> int:
        ok = 0
        for uid, socks in list(_connections.items()):
            if uid == exclude:
                continue
            for ws in list(socks):
                try:
                    await ws.send_json(data)
                    ok += 1
                except Exception:
                    logger.warning("WS broadcast 发送失败，移除连接", exc_info=True)
                    socks.remove(ws)
            if not socks:
                _connections.pop(uid, None)
        return ok

    @staticmethod
    def is_online(user_id: str) -> bool:
        return len(_connections.get(user_id, [])) > 0

    @staticmethod
    def online_count() -> int:
        return len(_connections)

    @staticmethod
    def list_online() -> list[str]:
        return list(_connections.keys())

    @staticmethod
    def device_count(user_id: str) -> int:
        return len(_connections.get(user_id, []))
