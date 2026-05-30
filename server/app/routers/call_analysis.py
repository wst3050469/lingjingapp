"""
灵境 - 电话话术分析 API

端点列表:
  POST   /api/v1/call-analysis/upload        — 上传录音文件 (异步: STT → AI分析)
  GET    /api/v1/call-analysis/records        — 获取分析历史列表
  GET    /api/v1/call-analysis/{record_id}    — 获取单条分析详情
  DELETE /api/v1/call-analysis/{record_id}    — 删除分析记录

工作流:
  upload → 保存音频文件 → 后台 Whsiper 转写 → DeepSeek AI 分析
  → 结果存入 call_analyses 表 → 前端轮询或按ID查询结果
"""
import os
import sys
import json
import logging
import time
import asyncio

from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from config import UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/call-analysis", tags=["call-analysis"])

# 允许的音频格式
ALLOWED_EXTENSIONS = {'.wav', '.mp3', '.m4a', '.ogg', '.amr'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


# ── 依赖: 用户认证 ──────────────────────────────────────

async def _get_user_from_token(token: str = Form(...)) -> dict:
    """验证 token 并返回用户信息"""
    if not token:
        raise HTTPException(status_code=401, detail="未提供认证token")

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT u.username as user_id, u.nickname, tu.tenant_id, t.company_name
               FROM users u
               LEFT JOIN tenant_users tu ON tu.user_id = u.username
               LEFT JOIN tenants t ON t.tenant_id = tu.tenant_id
               WHERE u.token = $1""",
            token,
        )
        if row:
            return dict(row)

    raise HTTPException(status_code=401, detail="无效的token")


# ── 辅助函数 ────────────────────────────────────────────

def _safe_json(val) -> dict:
    """安全解析 JSON 字段"""
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def _format_record(record: dict) -> dict:
    """格式化数据库记录为API响应"""
    return {
        "id": record["id"],
        "call_title": record.get("call_title", "通话分析"),
        "audio_filename": record.get("audio_filename", ""),
        "audio_duration_sec": record.get("audio_duration_sec", 0),
        "transcript_status": record.get("transcript_status", "pending"),
        "analysis_status": record.get("analysis_status", "pending"),
        "analysis_result": _safe_json(record.get("analysis_result", {})),
        "analysis_error": record.get("analysis_error", ""),
        "created_at": record.get("created_at").isoformat() if record.get("created_at") else "",
    }


# ── 上传并分析 ──────────────────────────────────────────

@router.post("/upload")
async def upload_call_analysis(
    audio: UploadFile = File(..., description="通话录音文件 (WAV/MP3/M4A/OGG/AMR, 最大50MB)"),
    token: str = Form(..., description="用户认证token"),
    call_title: str = Form("通话分析", description="通话标题(可选)"),
    duration_sec: int = Form(0, description="录音时长(秒,可选)"),
):
    """上传通话录音并启动分析

    流程:
      1. 验证token
      2. 保存音频文件
      3. 创建分析记录 (status=pending)
      4. 后台异步执行: STT转写 → AI分析 → 更新记录
      5. 立即返回记录ID (前端可轮询进度)
    """
    user = await _get_user_from_token(token)
    user_id = user["user_id"]
    tenant_id = user.get("tenant_id")

    # 验证文件类型
    ext = os.path.splitext(audio.filename or "audio.wav")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"error": f"不支持的音频格式: {ext}。支持: {', '.join(ALLOWED_EXTENSIONS)}"},
        )

    # 读取文件内容
    try:
        audio_bytes = await audio.read()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"读取音频失败: {e}"})

    if len(audio_bytes) < 1024:
        return JSONResponse(status_code=400, content={"error": "音频文件为空或过小"})

    if len(audio_bytes) > MAX_FILE_SIZE:
        return JSONResponse(
            status_code=400,
            content={"error": f"音频文件过大 ({len(audio_bytes)//1024//1024}MB)，请限制在50MB以内"},
        )

    # 保存文件到 uploads 目录
    safe_filename = f"call_{user_id}_{int(time.time())}{ext}"
    save_dir = os.path.join(UPLOAD_DIR, "call_analysis")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, safe_filename)

    try:
        with open(save_path, "wb") as f:
            f.write(audio_bytes)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"保存音频失败: {e}"})

    # 创建分析记录
    async with database.pool.acquire() as conn:
        record = await conn.fetchrow(
            """INSERT INTO call_analyses
               (user_id, tenant_id, call_title, audio_filename, audio_duration_sec, audio_size_bytes,
                transcript_status, analysis_status)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
               RETURNING id""",
            user_id, tenant_id, call_title, safe_filename, duration_sec, len(audio_bytes),
        )
        record_id = record["id"]

    # 后台异步执行 STT + AI 分析
    asyncio.create_task(_process_analysis(record_id, save_path, call_title))

    logger.info(f"通话分析任务已创建: id={record_id}, user={user_id}, file={safe_filename}")

    return {
        "id": record_id,
        "status": "pending",
        "message": "分析任务已创建，正在进行语音转写和AI分析",
    }



async def _auto_create_customer(record_id: int, transcript: str, tenant_id: str | None):
    """从通话转录文本中提取客户信息，自动创建/更新CRM客户档案"""
    if not tenant_id:
        return

    import re
    name = None
    phone = None

    # 提取电话
    m = re.search(r'(?:电话|手机|联系方式)[：:\s]*(\d{11})', transcript)
    if not m:
        m = re.search(r'(1[3-9]\d{9})', transcript)
    if m:
        phone = m.group(1) if m.lastindex else m.group(0)

    # 提取姓名
    m = re.search(r'(?:客户[：:\s]*|我是|这位是|贵姓|姓)[：:\s]*([\u4e00-\u9fff]{2,4})', transcript)
    if m:
        name = m.group(1)

    if not name and not phone:
        logger.info(f"[{record_id}] 未提取到客户信息，跳过")
        return

    async with database.pool.acquire() as conn:
        existing = None
        if phone:
            existing = await conn.fetchrow(
                "SELECT id, name FROM biz_customers WHERE tenant_id=$1 AND phone=$2",
                tenant_id, phone,
            )
        if not existing and name:
            existing = await conn.fetchrow(
                "SELECT id, name FROM biz_customers WHERE tenant_id=$1 AND name=$2",
                tenant_id, name,
            )
        if existing:
            await conn.execute(
                "UPDATE biz_customers SET notes=CONCAT(notes, $1), updated_at=NOW() WHERE id=$2",
                f"\n[通话分析#{record_id}] {transcript[:100]}...",
                existing["id"],
            )
            logger.info(f"[{record_id}] 更新客户: {existing['name']} (id={existing['id']})")
        elif name:
            row = await conn.fetchrow(
                "INSERT INTO biz_customers (tenant_id, name, phone, source, status, notes) VALUES ($1, $2, $3, 'call_analysis', '意向', $4) RETURNING id",
                tenant_id, name, phone or '',
                f"通过通话分析自动创建 (分析记录#{record_id})",
            )
            logger.info(f"[{record_id}] 创建客户: {name} (id={row['id']})")


async def _process_analysis(record_id: int, audio_path: str, call_title: str):
    """后台处理: Whisper STT → DeepSeek AI 分析 → 更新数据库"""
    logger.info(f"[{record_id}] 开始处理通话分析...")

    try:
        # ── Step 1: Whisper STT 转写 ──
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE call_analyses SET transcript_status='processing', updated_at=NOW() WHERE id=$1",
                record_id,
            )

        transcript_text = ""
        try:
            from services.transcribe import transcribe_audio_bytes

            loop = asyncio.get_event_loop()
            time.sleep(0.1)  # 给数据库一点时间提交

            with open(audio_path, "rb") as f:
                audio_bytes = f.read()

            transcript_text = await loop.run_in_executor(
                None, transcribe_audio_bytes, audio_bytes, "call_audio.wav"
            )
            transcript_text = (transcript_text or "").strip()
            logger.info(f"[{record_id}] STT完成: {len(transcript_text)}字")
        except Exception as e:
            logger.error(f"[{record_id}] STT失败: {e}")
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """UPDATE call_analyses
                       SET transcript_status='failed', transcript_text='',
                           analysis_status='failed', analysis_error=$1, updated_at=NOW()
                       WHERE id=$2""",
                    f"语音转写失败: {str(e)[:200]}", record_id,
                )
            return

        if not transcript_text:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """UPDATE call_analyses
                       SET transcript_status='failed', transcript_text='',
                           analysis_status='failed', analysis_error='未能识别到有效语音内容',
                           updated_at=NOW()
                       WHERE id=$1""",
                    record_id,
                )
            return

        # 更新转写结果
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE call_analyses SET transcript_text=$1, transcript_status='completed', updated_at=NOW() WHERE id=$2",
                transcript_text, record_id,
            )

        # ── Step 2: AI 分析 ──
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE call_analyses SET analysis_status='processing', updated_at=NOW() WHERE id=$1",
                record_id,
            )

        from services.call_analysis_service import analyze_call_transcript
        analysis_result = await analyze_call_transcript(transcript_text, call_title)

        # ── Step 3: 更新分析结果 ──
        if analysis_result["success"]:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """UPDATE call_analyses
                       SET analysis_result=$1::jsonb, analysis_status='completed',
                           updated_at=NOW()
                       WHERE id=$2""",
                    json.dumps(analysis_result["result"], ensure_ascii=False),
                    record_id,
                )
            logger.info(f"[{record_id}] 分析完成")

            # ── Step 4: 自动创建/更新客户档案 ──
            try:
                await _auto_create_customer(record_id, transcript_text, tenant_id)
            except Exception as e:
                logger.warning(f"[{record_id}] 自动创建客户失败: {e}")
        else:
            error_msg = analysis_result.get("error", "分析失败")
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """UPDATE call_analyses
                       SET analysis_status='failed', analysis_error=$1, updated_at=NOW()
                       WHERE id=$2""",
                    error_msg, record_id,
                )
            logger.error(f"[{record_id}] 分析失败: {error_msg}")

    except Exception as e:
        logger.error(f"[{record_id}] 处理异常: {e}", exc_info=True)
        try:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """UPDATE call_analyses
                       SET analysis_status='failed', analysis_error=$1, updated_at=NOW()
                       WHERE id=$2""",
                    f"处理异常: {str(e)[:200]}", record_id,
                )
        except Exception:
            pass


# ── 获取分析历史 ────────────────────────────────────────

@router.get("/records")
async def get_call_analysis_records(
    token: str = Query(..., description="用户认证token"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取当前用户的分析历史列表"""
    user = await _get_user_from_token(token)
    user_id = user["user_id"]
    offset = (page - 1) * page_size

    async with database.pool.acquire() as conn:
        # 查询当前用户的分析记录（也包含同租户其他成员的，如果用户有tenant）
        if user.get("tenant_id"):
            rows = await conn.fetch(
                """SELECT id, call_title, audio_filename, audio_duration_sec,
                          transcript_status, analysis_status, analysis_result, analysis_error,
                          created_at
                   FROM call_analyses
                   WHERE user_id=$1 OR (tenant_id=$2 AND tenant_id IS NOT NULL)
                   ORDER BY created_at DESC
                   LIMIT $3 OFFSET $4""",
                user_id, user["tenant_id"], page_size, offset,
            )
            count_row = await conn.fetchrow(
                """SELECT COUNT(*) as total FROM call_analyses
                   WHERE user_id=$1 OR (tenant_id=$2 AND tenant_id IS NOT NULL)""",
                user_id, user["tenant_id"],
            )
        else:
            rows = await conn.fetch(
                """SELECT id, call_title, audio_filename, audio_duration_sec,
                          transcript_status, analysis_status, analysis_result, analysis_error,
                          created_at
                   FROM call_analyses
                   WHERE user_id=$1
                   ORDER BY created_at DESC
                   LIMIT $2 OFFSET $3""",
                user_id, page_size, offset,
            )
            count_row = await conn.fetchrow(
                "SELECT COUNT(*) as total FROM call_analyses WHERE user_id=$1",
                user_id,
            )

    records = [_format_record(r) for r in rows]
    return {
        "records": records,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


# ── 获取单条分析详情 ────────────────────────────────────

@router.get("/{record_id}")
async def get_call_analysis_detail(
    record_id: int,
    token: str = Query(..., description="用户认证token"),
):
    """获取单条分析记录的完整详情"""
    user = await _get_user_from_token(token)

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM call_analyses WHERE id=$1", record_id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="分析记录不存在")

    # 权限检查：只能查看自己的或同租户的记录
    record_user_id = row["user_id"]
    if record_user_id != user["user_id"] and row.get("tenant_id") != user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="无权查看此记录")

    result = _format_record(row)
    result["transcript_text"] = row.get("transcript_text", "")
    return result


# ── 删除分析记录 ────────────────────────────────────────

@router.delete("/{record_id}")
async def delete_call_analysis(
    record_id: int,
    token: str = Query(..., description="用户认证token"),
):
    """删除分析记录及对应的音频文件"""
    user = await _get_user_from_token(token)

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, audio_filename FROM call_analyses WHERE id=$1", record_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="分析记录不存在")

        # 权限检查
        record_user_id = (await conn.fetchval("SELECT user_id FROM call_analyses WHERE id=$1", record_id))
        if record_user_id != user["user_id"]:
            raise HTTPException(status_code=403, detail="只能删除自己的分析记录")

        # 删除音频文件
        audio_filename = row.get("audio_filename", "")
        if audio_filename:
            audio_path = os.path.join(UPLOAD_DIR, "call_analysis", audio_filename)
            if os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except OSError as e:
                    logger.warning(f"删除音频文件失败: {audio_path} - {e}")

        # 删除数据库记录
        await conn.execute("DELETE FROM call_analyses WHERE id=$1", record_id)

    return {"success": True, "message": "分析记录已删除"}
