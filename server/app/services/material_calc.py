"""灵境 — 材料用量计算服务（国标配比 + 多材料类型）"""
import re
import logging

logger = logging.getLogger("lingjing.material_calc")

# ============================================================
# 国标材料配比（每立方米用量）
# 格式: {"材料名": {"amount": 数量, "unit": "单位"}}
# ============================================================

MATERIAL_FORMULAS = {
    "抗裂砂浆": {
        "name": "抗裂砂浆找平层",
        "description": "国标GB/T 25181-2019 预拌砂浆，抗裂砂浆用于找平层",
        "note": "厚度按设计图纸，通常3-5cm。干密度约1800kg/m³",
        "per_cubic_meter": {
            "水泥(42.5)":     {"amount": 350, "unit": "kg"},
            "黄砂(中砂)":     {"amount": 1450, "unit": "kg"},
            "抗裂纤维":        {"amount": 1.5, "unit": "kg"},
            "可再分散乳胶粉":  {"amount": 15, "unit": "kg"},
            "纤维素醚":        {"amount": 2, "unit": "kg"},
            "水":              {"amount": 260, "unit": "kg"},  # 约0.26m³
        },
    },
    "半干砂浆": {
        "name": "半干砂浆（半干硬性砂浆）",
        "description": "水灰比低，手捏成团落地即散。用于地坪找平、垫层",
        "note": "厚度通常3-8cm。干密度约2000kg/m³",
        "per_cubic_meter": {
            "水泥(42.5)":     {"amount": 380, "unit": "kg"},
            "黄砂(中粗砂)":   {"amount": 1600, "unit": "kg"},
            "钢纤维":         {"amount": 20, "unit": "kg"},
            "减水剂":         {"amount": 3, "unit": "kg"},
            "水":              {"amount": 180, "unit": "kg"},
        },
    },
    "自流平砂浆": {
        "name": "自流平砂浆",
        "description": "高流动性地坪找平材料",
        "per_cubic_meter": {
            "水泥(42.5)":     {"amount": 400, "unit": "kg"},
            "石膏":           {"amount": 100, "unit": "kg"},
            "石英砂(70-140目)": {"amount": 1200, "unit": "kg"},
            "可再分散乳胶粉":  {"amount": 20, "unit": "kg"},
            "消泡剂":         {"amount": 2, "unit": "kg"},
            "减水剂":         {"amount": 4, "unit": "kg"},
            "水":              {"amount": 280, "unit": "kg"},
        },
    },
    "混凝土C25": {
        "name": "C25商品混凝土",
        "description": "普通C25混凝土",
        "per_cubic_meter": {
            "水泥(42.5)":     {"amount": 350, "unit": "kg"},
            "黄砂":           {"amount": 650, "unit": "kg"},
            "石子(5-31.5mm)": {"amount": 1250, "unit": "kg"},
            "水":              {"amount": 185, "unit": "kg"},
        },
    },
    "无机磨石基层": {
        "name": "无机磨石基层砂浆",
        "description": "用于无机磨石地坪的基层",
        "per_cubic_meter": {
            "水泥(42.5)":     {"amount": 450, "unit": "kg"},
            "骨料(3-5mm)":    {"amount": 1400, "unit": "kg"},
            "硅微粉":         {"amount": 50, "unit": "kg"},
            "减水剂":         {"amount": 4, "unit": "kg"},
            "钢纤维":         {"amount": 20, "unit": "kg"},
            "水":              {"amount": 170, "unit": "kg"},
        },
    },
}


def calculate_material(
    formula_name: str,
    area: float,         # 平方米
    thickness_cm: float, # 厘米
) -> dict | None:
    """计算材料用量，返回 {material_name: {amount_kg, unit, total_ton}}"""
    # 模糊匹配
    matched = None
    for k, v in MATERIAL_FORMULAS.items():
        if k in formula_name or formula_name in k:
            matched = v
            break
    
    if not matched:
        # 尝试部分匹配
        for k, v in MATERIAL_FORMULAS.items():
            kw = re.sub(r'\(.*?\)', '', k)  # 去掉括号
            if kw.strip() in formula_name:
                matched = v
                break

    if not matched:
        return None

    # 体积 = 面积(m²) × 厚度(m)
    volume = area * (thickness_cm / 100)

    result = {
        "formula_name": matched["name"],
        "formula_description": matched.get("description", ""),
        "note": matched.get("note", ""),
        "area": area,
        "thickness_cm": thickness_cm,
        "volume_m3": round(volume, 3),
        "materials": {},
    }

    for material, per_cubic in matched["per_cubic_meter"].items():
        amount_kg = per_cubic["amount"] * volume
        unit = per_cubic["unit"]
        
        # 转为吨（≥1000kg 时）
        if unit == "kg" and amount_kg >= 1000:
            display = f"{amount_kg/1000:.3f}吨"
        elif unit == "kg":
            display = f"{amount_kg:.1f}kg"
        else:
            display = f"{amount_kg:.1f}{unit}"

        result["materials"][material] = {
            "amount": round(amount_kg, 1),
            "unit": unit,
            "display": display,
        }

    return result


def format_material_result(result: dict) -> str:
    """格式化为可读文本"""
    lines = [
        f"【{result['formula_name']}】材料用量计算",
        f"面积：{result['area']} m²",
        f"厚度：{result['thickness_cm']} cm",
        f"体积：{result['volume_m3']} m³",
    ]
    if result.get("note"):
        lines.append(f"参考说明：{result['note']}")
    lines.append("")
    lines.append("材料明细：")
    
    for material, detail in result["materials"].items():
        lines.append(f"  {material}：{detail['display']}")

    if result.get("formula_description"):
        lines.insert(1, f"说明：{result['formula_description']}")

    return "\n".join(lines)
