"""
灵境AI业务管家 - AI施工审批引擎
核心逻辑：项目经理提交施工申请 -> AI校验天气/养护期/规范 -> 自动批准/拒绝
"""
import json
import httpx
from datetime import datetime, date
from urllib.parse import quote

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

# wttr.in 免费天气API（无需注册，支持中文城市名）
WTTR_URL = "https://wttr.in/{location}?format=j1"


def _wind_kmh_to_beaufort(kmh: float) -> int:
    """风速km/h转蒲福风级"""
    if kmh < 1:
        return 0
    elif kmh <= 5:
        return 1
    elif kmh <= 11:
        return 2
    elif kmh <= 19:
        return 3
    elif kmh <= 28:
        return 4
    elif kmh <= 38:
        return 5
    elif kmh <= 49:
        return 6
    elif kmh <= 61:
        return 7
    elif kmh <= 74:
        return 8
    elif kmh <= 88:
        return 9
    elif kmh <= 102:
        return 10
    elif kmh <= 117:
        return 11
    else:
        return 12


async def get_weather(location: str, latitude: float = None, longitude: float = None) -> dict:
    """获取当前天气数据（使用wttr.in免费API）"""
    # 从location中提取城市名（去掉省/区/街道等细节）
    city = location
    for sep in ["省", "市", "区", "县"]:
        parts = city.split(sep)
        if len(parts) > 1:
            # 取第二段（市名），如"陕西省西安市..." -> "西安"
            city = parts[1] if parts[1] else parts[0]
            break
    # 如果还是很长，只取前4个字
    if len(city) > 4:
        city = city[:4]
    if not city:
        city = location[:6]

    try:
        url = WTTR_URL.format(location=quote(city))
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            data = resp.json()
            cur = data["current_condition"][0]

            temp = float(cur["temp_C"])
            humidity = float(cur["humidity"])
            wind_kmh = float(cur["windspeedKmph"])
            wind_scale = _wind_kmh_to_beaufort(wind_kmh)
            precip = float(cur.get("precipMM", 0))
            weather_text = cur.get("weatherDesc", [{}])[0].get("value", "")

            # weatherCode 映射中文
            zh_map = {
                "Sunny": "晴", "Clear": "晴", "Partly cloudy": "多云",
                "Cloudy": "阴", "Overcast": "阴", "Mist": "薄雾",
                "Fog": "雾", "Light rain": "小雨", "Moderate rain": "中雨",
                "Heavy rain": "大雨", "Light snow": "小雪", "Moderate snow": "中雪",
                "Heavy snow": "大雪", "Thunderstorm": "雷暴", "Patchy rain possible": "可能有零星小雨",
                "Light drizzle": "毛毛雨", "Freezing drizzle": "冻毛毛雨",
            }
            text_zh = zh_map.get(weather_text, weather_text)

            return {
                "available": True,
                "temp": temp,
                "humidity": humidity,
                "wind_scale": wind_scale,
                "wind_kmh": wind_kmh,
                "text": text_zh,
                "text_en": weather_text,
                "precip": precip,
                "feels_like": float(cur.get("FeelsLikeC", temp)),
                "city": city,
            }
    except Exception as e:
        return {
            "available": False,
            "temp": None,
            "humidity": None,
            "wind_scale": None,
            "text": f"天气查询失败: {str(e)[:50]}",
            "precip": None,
            "error": str(e),
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


async def check_curing_period(
    conn, tenant_id: str, project_id: int,
    from_stage: str, to_stage: str, min_days: int
) -> dict:
    """检查养护期：前序工序完成到现在是否满足最低天数"""
    row = await conn.fetchrow("""
        SELECT actual_end, planned_end, status
        FROM biz_processes
        WHERE tenant_id=$1 AND project_id=$2 AND stage=$3
        ORDER BY actual_end DESC NULLS LAST
        LIMIT 1
    """, tenant_id, project_id, from_stage)

    if not row:
        return {
            "pass": False,
            "reason": f"未找到前序工序 [{from_stage}] 的记录，无法确认养护期",
            "days_elapsed": 0,
            "min_days": min_days,
        }

    if row["status"] != "completed":
        return {
            "pass": False,
            "reason": f"前序工序 [{from_stage}] 尚未完成（当前状态: {row['status']}），不能开始 [{to_stage}]",
            "days_elapsed": 0,
            "min_days": min_days,
        }

    end_date = row["actual_end"] or row["planned_end"]
    if not end_date:
        return {
            "pass": False,
            "reason": f"前序工序 [{from_stage}] 缺少完成日期",
            "days_elapsed": 0,
            "min_days": min_days,
        }

    days_elapsed = (date.today() - end_date).days
    passed = days_elapsed >= min_days

    return {
        "pass": passed,
        "days_elapsed": days_elapsed,
        "min_days": min_days,
        "end_date": str(end_date),
        "reason": "" if passed else f"养护期不足: 已{days_elapsed}天，要求至少{min_days}天（差{min_days - days_elapsed}天）",
    }


async def check_attendance(conn, tenant_id: str, project_id: int) -> dict:
    """检查今日是否有人签到"""
    count = await conn.fetchval("""
        SELECT COUNT(DISTINCT user_id)
        FROM biz_attendance
        WHERE tenant_id=$1 AND project_id=$2
          AND type='check_in'
          AND check_time::date = CURRENT_DATE
    """, tenant_id, project_id)

    return {
        "pass": count > 0,
        "checked_in_count": count,
        "reason": "" if count > 0 else "今日无人打卡签到，请确认施工人员已到场",
    }


async def evaluate_approval(
    tenant_id: str,
    project_id: int,
    target_stage: str,
    applicant_name: str,
    request_content: str,
    project_location: str = "",
    project_latitude: float = None,
    project_longitude: float = None,
) -> dict:
    """
    核心审批引擎：运行所有适用规则，汇总结果
    返回: {"result": "approved/rejected/pending_review", "checks": {...}, "reject_reasons": [...]}
    """
    checks = {}
    reject_reasons = []
    warnings = []

    async with database.pool.acquire() as conn:
        # 加载该租户的所有活跃规则
        rules = await conn.fetch(
            "SELECT * FROM ai_construction_rules WHERE tenant_id=$1 AND is_active=TRUE",
            tenant_id,
        )

        for rule in rules:
            code = rule["rule_code"]
            ctype = rule["condition_type"]
            cval = json.loads(rule["condition_value"]) if isinstance(rule["condition_value"], str) else rule["condition_value"]
            severity = rule["severity"]

            # --- 温度/湿度/风力阈值规则 ---
            if ctype == "threshold" and cval.get("data_source") == "weather_api":
                if "weather" not in checks:
                    checks["weather"] = await get_weather(
                        project_location, project_latitude, project_longitude
                    )
                w = checks["weather"]
                if not w.get("available"):
                    checks[code] = {"pass": "unknown", "reason": "天气数据不可用，需人工确认"}
                    if severity == "critical":
                        warnings.append(f"[{rule['rule_name']}] 天气数据不可用，建议人工确认")
                    continue

                # 取对应的天气值
                unit = cval.get("unit", "")
                if unit == "celsius":
                    actual = w["temp"]
                elif unit == "percent":
                    actual = w["humidity"]
                elif unit == "beaufort":
                    actual = w["wind_scale"]
                else:
                    actual = None

                if actual is not None:
                    op = cval["operator"]
                    threshold = cval["value"]
                    if op == ">=" and actual < threshold:
                        passed = False
                    elif op == "<=" and actual > threshold:
                        passed = False
                    elif op == ">" and actual <= threshold:
                        passed = False
                    elif op == "<" and actual >= threshold:
                        passed = False
                    else:
                        passed = True

                    checks[code] = {
                        "pass": passed,
                        "actual": actual,
                        "threshold": threshold,
                        "operator": op,
                        "unit": unit,
                    }
                    if not passed:
                        msg = f"[{rule['rule_name']}] 当前{actual}{unit}, 要求{op}{threshold}{unit}"
                        if severity == "critical":
                            reject_reasons.append(msg)
                        else:
                            warnings.append(msg)

            # --- 养护期规则 ---
            elif ctype == "duration":
                from_stage = cval.get("process_from", "")
                to_stage = cval.get("process_to", "")
                min_days = cval.get("min_days", 0)

                # 仅当申请的目标工序匹配to_stage时才检查
                if target_stage and target_stage == to_stage:
                    result = await check_curing_period(
                        conn, tenant_id, project_id, from_stage, to_stage, min_days
                    )
                    checks[code] = result
                    if not result["pass"]:
                        msg = f"[{rule['rule_name']}] {result['reason']}"
                        if severity == "critical":
                            reject_reasons.append(msg)
                        else:
                            warnings.append(msg)

            # --- 布尔规则（降雨、考勤等） ---
            elif ctype == "boolean":
                condition = cval.get("condition", "")

                if condition == "no_precipitation":
                    if "weather" not in checks:
                        checks["weather"] = await get_weather(
                            project_location, project_latitude, project_longitude
                        )
                    w = checks["weather"]
                    if w.get("available"):
                        precip = w.get("precip", 0) or 0
                        weather_text = w.get("text", "")
                        is_raining = precip > 0 or any(k in weather_text for k in ["雨", "雪", "雷"])
                        checks[code] = {
                            "pass": not is_raining,
                            "precip": precip,
                            "weather_text": weather_text,
                        }
                        if is_raining:
                            msg = f"[{rule['rule_name']}] 当前天气: {weather_text}, 降水量{precip}mm"
                            if severity == "critical":
                                reject_reasons.append(msg)
                            else:
                                warnings.append(msg)

                elif condition == "all_workers_checked_in":
                    result = await check_attendance(conn, tenant_id, project_id)
                    checks[code] = result
                    if not result["pass"]:
                        msg = f"[{rule['rule_name']}] {result['reason']}"
                        if severity == "critical":
                            reject_reasons.append(msg)
                        else:
                            warnings.append(msg)

                elif condition == "ratio_confirmed":
                    # 材料配比需要人工确认，标记为需审核
                    checks[code] = {"pass": "manual", "reason": "需上传材料配比确认照片"}

        # --- 汇总决策 ---
        if reject_reasons:
            result = "rejected"
        elif any(c.get("pass") == "unknown" or c.get("pass") == "manual" for c in checks.values() if isinstance(c, dict)):
            result = "pending_review"
        else:
            result = "approved"

        # 写入审批记录
        await conn.execute("""
            INSERT INTO ai_approvals (
                tenant_id, project_id, applicant_name, approval_type,
                request_content, ai_checks, result, reject_reason, reviewed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
            tenant_id, project_id, applicant_name, "construction_start",
            request_content,
            json.dumps(checks, ensure_ascii=False, default=str),
            result,
            "\n".join(reject_reasons) if reject_reasons else "",
            "ai",
        )

        # 如果拒绝，同时创建预警
        if reject_reasons:
            for reason in reject_reasons:
                await conn.execute("""
                    INSERT INTO ai_alerts (
                        tenant_id, project_id, alert_type, severity,
                        title, detail, data
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                    tenant_id, project_id, "construction_violation", "critical",
                    f"施工审批被拒绝: {applicant_name}",
                    reason,
                    json.dumps({"applicant": applicant_name, "stage": target_stage, "checks": checks}, ensure_ascii=False, default=str),
                )

    return {
        "result": result,
        "checks": checks,
        "reject_reasons": reject_reasons,
        "warnings": warnings,
        "timestamp": datetime.now().isoformat(),
    }
