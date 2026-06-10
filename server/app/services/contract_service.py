"""灵境 — 合同服务（模板生成 + 法务审核）"""
import logging
from datetime import date

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger("lingjing.contract")

# ============================================================
# 建筑工程合同模板
# ============================================================

CONTRACT_TEMPLATES = {
    "施工合同": {
        "title": "建设工程施工合同",
        "content": """建设工程施工合同

发包人（甲方）：{party_a}
承包人（乙方）：{party_b}

依照《中华人民共和国合同法》、《中华人民共和国建筑法》及其他有关法律法规，遵循平等、自愿、公平和诚实信用的原则，双方就本建设工程施工事项协商一致，订立本合同。

第一条 工程概况
工程名称：{project_name}
工程地点：{address}
工程内容：{scope}
承包范围：{scope}

第二条 合同工期
开工日期：{start_date}
竣工日期：{end_date}
合同工期总日历天数：{duration}天

第三条 质量标准
工程质量标准：合格
验收标准：按国家现行建筑工程施工质量验收统一标准及相应专业验收规范执行。

第四条 合同价款
金额（大写）：{amount_cn}
（小写）：¥{amount}
本合同价款采用固定综合单价方式确定。

第五条 付款方式
1. 合同签订后7日内，甲方向乙方支付合同总价的30%作为预付款；
2. 工程进度款按月支付，每月25日前乙方提交已完成工程量报告，甲方在收到报告后7日内审核支付；
3. 工程竣工验收合格后，支付至合同总价的95%；
4. 剩余5%作为质量保证金，质保期满后30日内无息退还。

第六条 双方责任
甲方责任：
1. 提供施工所需的图纸及相关技术资料；
2. 办理施工许可证等法定手续；
3. 按合同约定及时支付工程款。

乙方责任：
1. 按合同约定组织施工，确保工程质量和安全；
2. 自行解决施工所需的水、电及临时设施；
3. 接受甲方和监理单位的监督检查。

第七条 违约责任
1. 甲方逾期付款的，每逾期一日按应付款的万分之五支付违约金；
2. 乙方逾期竣工的，每逾期一日按合同总价的万分之五支付违约金；
3. 工程质量不合格的，乙方负责无偿返工至合格。

第八条 争议解决
本合同在履行过程中发生的争议，由双方协商解决；协商不成的，向项目所在地人民法院提起诉讼。

第九条 附则
本合同一式四份，甲乙双方各持两份，具有同等法律效力。
本合同自双方法定代表人或委托代理人签字并加盖公章之日起生效。

甲方（盖章）：{party_a}
法定代表人/委托代理人：____________
日期：{sign_date}

乙方（盖章）：{party_b}
法定代表人/委托代理人：____________
日期：{sign_date}""",
    },

    "地坪工程合同": {
        "title": "地坪工程施工合同",
        "content": """地坪工程施工合同

发包方（甲方）：{party_a}
承包方（乙方）：{party_b}

经甲乙双方友好协商，就甲方委托乙方承担地坪工程事宜，达成如下协议：

第一条 工程概况
项目名称：{project_name}
施工地点：{address}
施工面积：约________平方米
施工内容：{scope}

第二条 材料与工艺
主要材料：________
施工工艺：________
颜色要求：________

第三条 合同价款
合同总金额：¥{amount}（大写：{amount_cn}）
综合单价：¥________元/平方米
以上价格含材料费、人工费、机械费、管理费、税金。

第四条 工期要求
计划开工日期：{start_date}
计划竣工日期：{end_date}
施工总工期：{duration}天（如遇不可抗力因素工期顺延）

第五条 付款方式
1. 合同签订后支付合同总额30%作为备料款；
2. 材料进场后支付合同总额30%；
3. 工程施工至50%支付合同总额20%；
4. 工程竣工验收合格后支付合同总额15%；
5. 余款5%作为质保金，保修期满后支付。

第六条 质量标准和验收
1. 工程质量执行国家现行地坪工程技术规范；
2. 甲方委派现场代表监督施工质量；
3. 工程完工后由双方共同验收，验收合格后签署验收报告。

第七条 保修条款
工程保修期为____年，自竣工验收合格之日起计算。
保修期内因施工质量问题造成的损坏，乙方负责免费维修。

第八条 安全责任
乙方应严格执行安全操作规程，因乙方原因造成的安全事故由乙方承担。

第九条 附则
1. 本合同未尽事宜，双方另行协商并签订补充协议；
2. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。

甲方（盖章）：{party_a}
代表签字：____________
日期：{sign_date}

乙方（盖章）：{party_b}
代表签字：____________
日期：{sign_date}""",
    },
}

# ============================================================
# 合同审核提示词
# ============================================================

REVIEW_PROMPT = """你是一位资深建筑工程法律顾问。请以甲方（发包方）的立场审核以下合同文本，找出风险点和不利条款。

请按以下结构输出审核意见：

**1. 总体评价**
一句话概括合同整体风险水平（低/中/高）和主要原因。

**2. 关键风险条款**
逐条列出对甲方不利的条款，每条包含：
- 原文引用（或条款位置）
- 风险分析
- 修改建议

**3. 缺失条款**
列出本合同缺失但建筑工程合同应包含的重要条款。

**4. 金额与支付风险**
检查付款节点、比例、违约金是否合理。

**5. 合规提醒**
法律强制性规定方面的提醒。

合同文本："""


# ============================================================
# AI 合同生成（DeepSeek）
# ============================================================

async def generate_contract_content(
    template_name: str,
    project_name: str = "",
    party_a: str = "",
    party_b: str = "",
    amount: float = 0,
    address: str = "",
    scope: str = "",
    start_date: str = "",
    end_date: str = "",
    duration: str = "60",
) -> str | None:
    """基于模板 + 项目信息生成合同全文"""
    tmpl = CONTRACT_TEMPLATES.get(template_name)
    if not tmpl:
        # 尝试模糊匹配
        for k in CONTRACT_TEMPLATES:
            if k in template_name or template_name in k:
                tmpl = CONTRACT_TEMPLATES[k]
                break
    if not tmpl:
        return None

    try:
        amount_float = float(amount) if amount else 0
    except (ValueError, TypeError):
        amount_float = 0

    def num_to_cn(n: float) -> str:
        units = ["", "拾", "佰", "仟", "万"]
        digits = "零壹贰叁肆伍陆柒捌玖"
        if n == 0:
            return "零元整"
        yuan = int(n)
        jiao = int(round((n - yuan) * 100))
        
        def _convert(num: int) -> str:
            if num == 0:
                return ""
            s = str(num)
            result = []
            for i, ch in enumerate(reversed(s)):
                d = int(ch)
                if d == 0:
                    if result and result[-1] != "零":
                        result.append("零")
                else:
                    result.append(digits[d] + units[i])
            while result and result[-1] == "零":
                result.pop()
            return "".join(reversed(result)) + "元"
        
        result = _convert(yuan)
        if jiao > 0:
            result += f"{digits[jiao//10]}角" if jiao >= 10 else ""
            if jiao % 10 > 0:
                result += f"{digits[jiao%10]}分"
        else:
            result += "整"
        return result

    today = date.today().isoformat()
    content = tmpl["content"].format(
        party_a=party_a or "________",
        party_b=party_b or "________",
        project_name=project_name or "________",
        address=address or "________",
        scope=scope or "按图纸及工程量清单约定",
        amount=f"{amount_float:,.2f}" if amount_float else "________",
        amount_cn=num_to_cn(amount_float) if amount_float else "________",
        sign_date=today,
        start_date=start_date or "________",
        end_date=end_date or "________",
        duration=duration or "________",
    )
    return content


# ============================================================
# AI 合同审核（DeepSeek）
# ============================================================

async def review_contract(text: str) -> str | None:
    """调用 DeepSeek 以法务角度审核合同"""
    prompt = REVIEW_PROMPT + text[:8000]

    import httpx
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                    "temperature": 0.3,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            logger.error(f"合同审核API失败: {resp.status_code}")
            return None
    except Exception as e:
        logger.error(f"合同审核异常: {e}")
        return None
