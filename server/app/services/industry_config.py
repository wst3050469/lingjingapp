"""灵境平台 - 行业模板配置"""

INDUSTRIES = [
    {
        "code": "construction",
        "name": "建筑工程",
        "description": "地坪/装修/建筑施工/工程管理",
        "welcome_chips": [
            "今天哪个项目需要关注？",
            "帮我看看各项目考勤情况",
            "最近有什么质量问题？",
            "各项目资金情况怎么样？",
        ],
        "ai_addon": "你熟悉建筑工程行业，了解施工流程、质量管控、工期管理、材料采购、安全规范等专业知识。",
    },
    {
        "code": "floor",
        "name": "地坪",
        "description": "无机磨石/环氧磨石/固化地坪/施工",
        "welcome_chips": [
            "今天哪个工地需要关注？",
            "帮我看看各工地考勤情况",
            "最近有什么质量或技术问题？",
            "各项目资金情况怎么样？",
        ],
        "ai_addon": "你熟悉地坪行业，了解无机磨石、环氧磨石、固化地坪的施工工艺、材料配比、质量管控、工期管理、成本核算等专业知识。",
    },
    {
        "code": "restaurant",
        "name": "餐饮",
        "description": "餐厅/外卖/食品加工/连锁餐饮",
        "welcome_chips": [
            "今天各门店营业额怎么样？",
            "帮我看看食材库存情况",
            "最近客户投诉有哪些？",
            "这周人力成本怎么样？",
        ],
        "ai_addon": "你熟悉餐饮行业，了解门店运营、食材管理、成本控制、客户服务、食品安全等专业知识。",
    },
    {
        "code": "retail",
        "name": "零售",
        "description": "门店/电商/批发/供应链",
        "welcome_chips": [
            "今天哪些商品卖得好？",
            "库存预警有哪些？",
            "这周销售趋势怎么样？",
            "帮我看看各门店业绩",
        ],
        "ai_addon": "你熟悉零售行业，了解库存管理、销售分析、供应链优化、客户运营、促销策略等专业知识。",
    },
    {
        "code": "manufacturing",
        "name": "制造业",
        "description": "工厂/生产/加工/品控",
        "welcome_chips": [
            "今天生产线运转怎么样？",
            "帮我看看订单交付情况",
            "最近有什么质检问题？",
            "原材料库存够用吗？",
        ],
        "ai_addon": "你熟悉制造业，了解生产排程、质量控制、设备维护、供应链管理、成本核算等专业知识。",
    },
    {
        "code": "services",
        "name": "服务业",
        "description": "咨询/培训/物业/家政/维修",
        "welcome_chips": [
            "今天有多少待处理的工单？",
            "帮我看看客户满意度",
            "这周接了多少新单？",
            "团队工作量分配合理吗？",
        ],
        "ai_addon": "你熟悉服务业，了解客户管理、工单调度、服务质量、团队效率、客户满意度等专业知识。",
    },
]

_INDEX = {i["code"]: i for i in INDUSTRIES}


def get_industry_config(code: str) -> dict | None:
    """根据行业代码获取配置"""
    return _INDEX.get(code)


def get_welcome_chips(code: str, role: str = "owner") -> list[str]:
    """获取行业+角色对应的欢迎引导语"""
    if role == "member" or role == "":
        return [
            "我是新成员，请问怎么开始？",
            "帮我了解一下平台功能",
            "随便聊聊",
        ]
    if role == "worker":
        return [
            "帮我打个卡",
            "查看我的考勤记录",
            "查看我的工资",
            "我要请款",
        ]
    if role == "project_manager":
        return [
            "帮我打个卡",
            "汇报今天施工进度",
            "项目资金使用情况",
            "帮我录个物料采购",
            "我要报销一笔费用",
            "最近有什么质检问题？",
            "看看工人排班情况",
        ]
    if role == "technician":
        return [
            "帮我录入一个样板",
            "查一下磨石面层配方",
            "今天有哪些项目要打样？",
            "看看最近的样板记录",
        ]
    # owner / admin — 原行业 chips
    cfg = _INDEX.get(code)
    if cfg:
        return cfg["welcome_chips"]
    return ["有什么想聊的？", "帮我分析个问题", "最近有什么需要关注的？", "帮我理一下思路"]


def get_ai_addon(code: str) -> str:
    """获取行业对应的AI知识补充"""
    cfg = _INDEX.get(code)
    if cfg:
        return cfg["ai_addon"]
    return ""


PERSONAL_WELCOME_CHIPS = [
    "帮我分析一个问题",
    "帮我写点东西",
    "给我一些建议",
    "帮我做个计划",
]


def get_personal_chips() -> list[str]:
    """获取个人版欢迎引导语"""
    return PERSONAL_WELCOME_CHIPS
