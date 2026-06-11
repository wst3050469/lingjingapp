"""灵境平台 - 数据库连接"""
import asyncpg
from pgvector.asyncpg import register_vector
import config

pool: asyncpg.Pool | None = None


async def init_pool():
    global pool
    pool = await asyncpg.create_pool(
        config.DATABASE_URL, min_size=2, max_size=10, command_timeout=30
    )
    async with pool.acquire() as conn:
        await register_vector(conn)


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


async def get_conn():
    async with pool.acquire() as conn:
        await register_vector(conn)
        yield conn
