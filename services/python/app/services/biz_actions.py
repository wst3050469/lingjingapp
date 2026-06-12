"""
灵境AI业务管家 - 业务动作执行引擎
检测用户对话中的写入意图，直接执行业务动作（写数据库），
返回执行结果注入AI上下文，让AI代为确认。
核心理念：用户说话 → 灵境干活 → AI汇报结果
"""
import re
from datetime import datetime, date
import json
import time
import hashlib
import secrets
import bcrypt
import sys, os
import logging
logger = logging.getLogger("lingjing.biz_actions")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
import db as database


# ============================================================
# 角色权限映射
# ============================================================

_ROLE_PERMISSIONS = {
    "owner":           {"*"},
    "admin":           {"*"},
    "project_manager": {
        "self_checkin", "fund_request", "submit_expense",
        "update_progress",
        "add_customer", "add_supplier",
        "change_own_password",
        "generate_contract", "review_contract", "calc_material",
        "web_search", "add_invoice",
    },
    "member":          {"change_own_password", "web_search"},
}


def _check_permission(user: dict, action_id: str) -> str | None:
    """检查用户是否有执行指定操作的权限，返回拒绝原因或 None（允许）"""
    role = user.get("tenant_role") or "member"
    allowed = _ROLE_PERMISSIONS.get(role, set())
    if "*" in allowed or action_id in allowed:
        return None
    _CN = {"member": "成员"}
    return f"您当前是「{_CN.get(role, role)}」角色，没有执行此操作的权限。请联系管理员。"


# ============================================================
# 动作意图检测
# ============================================================

ACTION_PATTERNS = {
    "add_customer": {
        "triggers": [
            r"(?:新|来了[个一]?|有[个一]?|接到|录[个一]?|加[个一]?)客户",
            # 排除"调出/查看/查询"等纯查询词 → 不应触发录入
            r"(?<!调出)(?<!查看)(?<!查询)(?<!列出)客[资户]信息",
            r"客户叫",
            # 有手机号+录入/添加/新增等动词就触发（跨行匹配）
            r"(?:录[个一]?|添加|新增|记[个一]?|存[个一]?|录入|保存|记录)[\s\S]*?1[3-9]\d{9}",
            r"1[3-9]\d{9}[\s\S]*?(?:录[个一]?|添加|新增|记[个一]?)",
            # 明确"录入为客户/存为客户/加为客户"模式（跨行）
            r"(?:录[入个一]?|存[个一]?|加[个一]?|记[个一]?|归[个一]?)(?:入|为|到)[\s\S]*?客户",
            r"(?:这|那)是[个一]?客户",
            r"客户[\s\S]*?资料",
            # 收货人/收件人 + 手机号 → 用户粘贴快递地址 → 自动触发客户录入（跨行）
            r"(?:收货人|收件人)[：:\s]*[\u4e00-\u9fff][\s\S]*?1[3-9]\d{9}",
            # 手机号 + 地址信息（所在地区/详细地址/项目部）→ 大概率是录入客户（跨行）
            r"1[3-9]\d{9}[\s\S]*?(?:所在地区|详细地址|项目部|工地)",
            # 无明确录入词但有"也录入/也存/也加" → 上下文延续录入
            r"也(?:录入|录|存|加|记|归)[个一]?(?:进去|入|起|上)?",
        ],
        "description": "录入新客户",
    },
    "add_supplier": {
        "triggers": [
            r"(?:新|录[个一]?|加[个一]?|添加|有[个一]?)(?:供应商|供货商|材料商)",
            r"(?:供应商|供货商|材料商).*(?:录|加|添|存)",
            r"是.*(?:供应商|供货商|材料商)",
            r"(?:供应商|供货商|材料商).*1[3-9]\d{9}",
            r"1[3-9]\d{9}.*(?:供应商|供货商|材料商)",
            r"录入.*供应商|归.*供应商",
            # 新增：明确"录入为供应商/存为供应商/加为供应商"模式
            r"(?:录[入个一]?|存[个一]?|加[个一]?|记[个一]?|归[个一]?)(?:入|为|到).*(?:供应商|供货商|材料商)",
            r"(?:这|那)是[个一]?(?:供应商|供货商|材料商)",
            r"(?:供应商|供货商|材料商).*资料",
        ],
        "description": "录入供应商",
    },
    "submit_expense": {
        "triggers": [
            r"(?:采购了?|买了|购买了?|进了|花了|支出|付了|付款|开了|开支|批了|日结|日付).*\d",
            r"\d+.*(?:采购|买[了到]|付了|花了|进货)",
            r"报销",
            r"(?:采购单|采购记录|记[个一]?采购)",
            r"(?:付了|付给|支付了|转给).*(?:钱|款|元|块|¥)",
        ],
        "description": "采购/费用记录（零星采购/原料采购/临时工零星支付）",
    },
    "fund_request": {
        "triggers": [
            r"(?:申请|要[点些]|转[点些]|拨[点些])(?:备用金|资金|钱|款)",
            r"备用金",
        ],
        "description": "备用金申请",
    },
    "create_project": {
        "triggers": [
            r"(?:新|接了[个一]?|签了[个一]?|开个|建个)(?:项目|工程|工地|单子)",
        ],
        "description": "创建新项目",
    },
    "update_progress": {
        "triggers": [
            r"(?:完成了?|做完了?|完工了?|结束了?).*(?:基层|面层|打磨|工序|施工)",
            r"进度.*\d+%?",
            r"\d+%.*(?:进度|完成)",
        ],
        "description": "更新项目进度",
    },
    "advance_customer": {
        "triggers": [
            r"(?:联系了|打了电话|发了报价|报价给|寄样|发样品|打样|面谈|见面|签约了?|签了合同|成交|做完|竣工|售后|跟进|询价|大样|小样)",
            r"(?:状态|阶段|进度).*(?:改为|改成|变为|更新|设置|设|修改)",
        ],
        "description": "推进客户阶段 / 设置客户状态",
    },
    "bind_project": {
        "triggers": [
            r"(?:绑定|安排|调[到去]|分配到|派到|派去|去|放到).*(?:项目|工地|工程)",
            r"(?:项目|工地|工程).*(?:绑定|安排|分配|加入)",
        ],
        "description": "绑定成员到项目",
    },
    "unbind_project": {
        "triggers": [
            r"(?:解绑|撤出|调离|离开|退出|撤回).*(?:项目|工地|工程)",
            r"(?:项目|工地|工程).*(?:解绑|撤出|调离|退出)",
        ],
        "description": "从项目解绑成员",
    },
    "self_checkin": {
        "triggers": [
            r"(?:帮我)?打卡",
            r"(?:我)?(?:到了|上工了?|来了|到工地了|到项目了)",
            r"(?:我)?(?:下班|收工|走了|回去了|下工)",
            r"签到",
        ],
        "description": "自助打卡",
    },
    "add_recipe": {
        "triggers": [
            r"(?:新|录[个一]?|加[个一]?|添加|新增|记[个一]?|存[个一]?)配方",
            r"配方.*(?:录[个一]?|添加|新增|记[个一]?)",
            r"(?:配方|菜谱|工艺).*(?:录[个一]?|添加|新增|记[个一]?)",
        ],
        "description": "录入新配方",
    },
    "add_template_image": {
        "triggers": [
            r"(?:新|录[个一入]?|加[个一]?|添加|新增|存[个一]?)样板(?!记录|历史|查询|列表)",
            r"(?:样板|模板|样图|参考图|打样|采样|样品).*(?:录[个一入]?(?!记录)|添加|新增|上传|做|打|保存)",
            r"\d+\s*号\s*(?:样板|样品|打样|模板)",
            r"(?:录|做|打|要|新|加|录入)(?:[个一]?)\s*\d*\s*号?\s*(?:样板|样品|样)",
            r"(?:就|就按|就照)(?:这个|这样|你说的|刚才的|之前)(?:录|存|保存|记|做)",
            r"(?:就|就按)(?:录|存|保存).*(?:这个|它|了|吧|行)",
            r"打[个一]?\s*(?:样|样板|样品)(?!阶段|确认)",
            r"采[个一]?\s*样",
            r"录[个一]?\s*(?:样|样板|打样)",
            r"(?:帮我|给我)\s*(?:录|打|做|存)(?:[个一]?)\s*(?:样|样板|样品|打样)",
        ],
        "description": "上传样板/打样图片（照片选填）",
    },
    "reset_member_password": {
        "triggers": [
            r"(?:把|将|给|帮|为).*(?:密码|登录密码|账户密码).*(?:改[成为]|改为|改成|设[为置]|修改成?|重置[成为]?)",
            r"(?:修改|重置|改|换).*(?:密码|登录密码|账户密码)",
            r"(?:密码|登录密码).*(?:改[成为]|改成|改为|设[为置]|修改|重置)",
        ],
        "description": "修改/重置成员密码",
    },
    "rename_member": {
        "triggers": [
            r"(?:把|将|给).{0,10}(?:改[成为回]|改为|改成|改回|名字改[成为回]|名称改[成为回]|修改名字[为成回]|修改名称[为成回]|更名为)",
            r"(?:改名字|改名|换名字|重命名|改名称).*(?:为|成|叫|是)",
            r"(?:名字|名称|姓名).*(?:改[为成回]?|改成|改为|修改成|改回|更名)",
            r"(\S+)\s*(?:改成|改为|改名为|改回|名字改成|更名为)\s*(\S+)",
        ],
        "description": "修改团队成员名称",
    },
    "change_own_password": {
        "triggers": [
            r"(?:我的?|自己的?|本人的?)\s*密码\s*(?:忘了|不记得|想改[成为]?|想修改|想重置|要改|改成|改为|设为|修改|重置)",
            r"(?:帮我|给我|我要|我想)\s*(?:修改|重置|改|换)\s*(?:(?:我的?|登录|的)\s*)?\s*密码",
            r"(?:帮我|给我)\s*密码\s*(?:改[成为]|改成|改为|修改|重置)",
            r"密码\s*(?:改[成为]|改成|改为|修改|重置)",
            r"(?:修改|重置|改)\s*(?:登录)?\s*密码",
        ],
        "description": "修改自己的登录密码",
    },
    "approve_finance": {
        "triggers": [
            r"(?:批准|同意|通过).*(?:费用|报销|申请|备用金)",
            r"(?:费用|报销|申请|备用金).*(?:批准|同意|通过)",
            r"(?:批准|同意|通过)\s*\$?\d+",
        ],
        "description": "审批通过费用",
    },
    "reject_finance": {
        "triggers": [
            r"(?:拒绝|驳回|不同意).*(?:费用|报销|申请|备用金)",
            r"(?:费用|报销|申请|备用金).*(?:拒绝|驳回|不同意)",
        ],
        "description": "驳回费用审批",
    },
    "add_invoice": {
        "triggers": [
            r"(?:录[个一]?|录入|新增|添加|记[个一]?|记录).*(?:发票|票)",
            r"(?:收到|开[张了到]?|开出|接收|拿[了到]|有[张了]|来[张了]).*(?:进项|销项)?\s*(?:发票|票)",
            r"(?:发票|票).*(?:号码|编号|号[码]?)[：:\s]*[A-Za-z0-9\-]+",
            r"INV[-–—]\d+",
            r"发票[\s\S]*?含税",
            r"(?:帮[我]?|替[我他]?|给[我他]?)(?:录[个一]?|录入|记[个一]?|记录|识别|认).*(?:发票|票)",
            r"(?:这|那|上传的?)[\s\S]*?发票",
            r"(?:公司|企业).*(?:开票|发票|票)",
            r"开[张了到]?\s*(?:张)?\s*(?:发票|票)",
        ],
        "description": "录入发票（进项/销项）",
    },
    "complete_todo": {
        "triggers": [
            r"(?:完成了?|做好了?|处理了?|搞定).*(?:待办|提醒|任务)",
            r"(?:待办|提醒|任务).*(?:完成了?|做好了?|处理了?|搞定)",
            r"完成\s*\d+",
        ],
        "description": "完成待办事项",
    },
    "send_to_factory": {
        "triggers": [
            r"(?:样品|样板|打样).*(?:发工厂|发到工厂|发给工厂|调试大样|生产|量产)",
            r"(?:发到|发给|发).*(?:工厂|生产).*(?:样品|样板|打样)",
            r"调试大样",
            r"发工厂",
        ],
        "description": "发送样品到工厂调试生产",
    },
    "generate_contract": {
        "triggers": [
            r"(?:生成|做[个一]?|写[个一]?|起草|拟[个一]?|帮我做|帮我写|帮我生成|新建|创建).*(?:合同|协议)",
            r"(?:参照|按照|根据|按).*(?:合同|模板).*(?:生成|做|写|起草)",
            r"(?:合同|协议).*(?:生成|做[个一]?|写[个一]?|起草|拟[个一]?)",
            r"(?:拟|签|做|写|订)个?合同",
        ],
        "description": "生成/起草合同",
    },
    "review_contract": {
        "triggers": [
            r"(?:审核|审[阅查]|看[一下]|帮我看看|帮我看[一下]).*(?:合同|协议)",
            r"法务.*(?:审核|审[阅查])",
            r"(?:以法务|用法律|站在.*角度).*(?:审核|审[阅查]|看)",
            r"(?:合同|协议).*(?:审核|审[阅查]|帮我看)",
        ],
        "description": "法务审核合同",
    },
    "calc_material": {
        "triggers": [
            r"(?:计算|算一下|帮我算|算算|用量|要用多少|需要多少).*(?:砂浆|水泥|黄砂|材料|混凝土|磨石|找出|找平)",
            r"(?:平方米|平米|m2|㎡).*(?:砂浆|水泥|材料|找平|计算|用量)",
            r"帮我.*(?:算|计算).*(?:用量|材料)",
            r"(?:材料|砂浆).*(?:用量|预算|计算)",
        ],
        "description": "材料用量计算",
    },
    "update_sample": {
        "triggers": [
            # 阶段: "3号样板已确认" / "这个样板处于打样阶段" / "样板确认中"
            r"(?:样板|样品|打样).*(?:已确认|确认了|确认过)",
            r"(?:样板|样品|打样).*(?:打样阶段|确认阶段|确认中|待确认)",
            r"(?:这个|那个|该)?\s*(?:样板|样品).{0,8}(?:处于|在|是|已进[入到])?\s*(?:打样阶段|确认阶段|确认中|已确认)",
            r"\d+\s*号\s*(?:样板|样品).*(?:确认|打样)",
            # 签约: "3号样板已签约" / "这个样板还没签"
            r"\d+\s*号\s*(?:样板|样品)\s*已签",
            r"(?:样板|样品).*(?:签约了?|已签约|签了合同|签了|没签约|未签约|还没签|还没签约)",
            r"(?:这个|那个|该)\s*样板\s*(?:签约了?|已签约|没签约|还没签)",
            # 绑定项目: "把3号样板绑到XX项目"
            r"(?:把|将|给)\s*\d*\s*号?\s*(?:样板|样品).*(?:绑[定到]|关联到?|绑定到?|关联到)", 
            r"(?:样板|样品).*(?:绑[定到]|关联到?|绑定到?)",
        ],
        "description": "更新样板信息（阶段/签约/绑定项目）",
    },
    "web_search": {
        "triggers": [
            # 帮我看一下/给我搜搜/查一下/看看 等
            r"(?:帮[我]?|给[我他]|替[我他])?(?:搜|搜索|查|查找|找|看|看看|了解)[一一下]?(?:搜索|网上|网络|在线|一下|看看|看|下)?",
            r"(?:网上|网络|在线)(?:搜|查|找|看看)[一一下]?",
            r"(?:搜[一一下]|查[一一下]|找[一一下]|看看|搜搜|查查).{0,15}(?:价格|多少钱|报价|行情|最新|目前|现在)",
            r"(?:和|与|跟|对比?).{0,6}(?:竞品|竞争对手|同行|对手).{0,6}(?:对比|比较|有什么区别|差在哪)",
            r"(?:产品|东西|服务).{0,6}(?:价格|对比|比较|怎么样)",
            r"看看.{0,6}(?:别人|同行|市场|网上).{0,6}(?:怎么|如何|什么|多少)",
            r"(?:查|搜|找).{0,4}(?:标准|规范|国标|政策|法规|规定)",
            r"(?:最近|现在|目前).{0,10}(?:行情|市场|价格|趋势|情况)",
            r"(?:搜|查|找|了解|看看)[一一下]?(?:看看|一下)?(?:别人|同行|市场|网上|网络|竞品)",
        ],
        "description": "网络搜索（产品/竞品/行情/标准）",
    },
    "analyze_wechat": {
        "triggers": [
            r"(?:分析|整理|归类|总结|查看|看看).{0,6}(?:群聊|微信|群消息|聊天记录|消息)",
            r"(?:群聊|微信|群消息).{0,6}(?:分析|整理|归类|总结|查看|摘要|统计)",
            r"(?:今天|这个月|最近|上周).{0,10}(?:群聊|微信|群|消息).{0,6}(?:说|聊|讨论|什么|内容)",
            r"(?:群里|群消息|微信群).{0,10}(?:有什么重要|说了什么|讨论了|有哪些)",
            r"帮[我]?.{0,6}(?:看看|分析|整理|归类).{0,6}(?:群|微信|消息|聊天记录)",
            r"微信消息.{0,6}(?:归类|整理|分类|分析)",
        ],
        "description": "分析微信群聊消息（自动归类/摘要/项目关联）",
    },
    "import_contacts": {
        "triggers": [
            r"(?:帮[我]?|把|将|给\s*我)?(?:导入|导进|读取|读|取|载入).*(?:通讯录|联系人|电话本|通信录)",
            r"(?:通讯录|联系人|电话本).*(?:导入|导进|读取|读|取|载入)",
            r"(?:我要|我想|帮我|请帮我).{0,6}(?:导入|读取|导进).{0,4}(?:通讯录|联系人)",
        ],
        "description": "导入手机通讯录（一键导入为线索）",
    },
    "query_import_data": {
        "triggers": [
            r"(?:看看|查看|查一下|调出|显示|列出来).{0,8}(?:导入|已导入|导入的)",
            r"(?:导入|已导入|导入的).{0,8}(?:数据|记录|短信|联系人|通讯录|微信)",
            r"(?:刚才|之前|昨天|上次).{0,6}(?:导入).{0,8}(?:数据|记录|短信|联系人|通讯录|微信)",
            r"有哪些(?:导入|已导入)",
        ],
        "description": "查询已导入的数据（短信/通讯录/微信记录）",
    },
}


def detect_action_intent(message: str) -> list[str]:
    """检测消息中的业务动作意图，返回匹配的动作列表"""
    intents = []
    for action_id, cfg in ACTION_PATTERNS.items():
        for pattern in cfg["triggers"]:
            if re.search(pattern, message):
                intents.append(action_id)
                break
    
    # 后置过滤：纯查询消息不应触发写入动作
    _QUERY_ONLY_RE = re.compile(r'(?:调出|查看|查询|列出|看看|看一下|显示|列出来|查下|找下|给我看|帮我查|帮我找)')
    _WRITE_RE = re.compile(r'(?:录入|录[个一]|添加|新增|保存|记录|加[个一]|存[个一]|记[个一]|归入|存为|录为|也(?:录入|录|存|加|记))')
    
    if _QUERY_ONLY_RE.search(message) and not _WRITE_RE.search(message):
        # 移除写入类意图，保留查询/展示类
        intents = [i for i in intents if i not in ("add_customer", "add_supplier", "submit_expense", "send_to_factory", "add_invoice")]
    
    return intents


# ============================================================
# 参数提取器（从自然语言中提取结构化数据）
# ============================================================

_PHONE_RE = re.compile(r'1[3-9]\d{9}')
_AMOUNT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*(?:万|w)', re.IGNORECASE)
_AMOUNT_PLAIN_RE = re.compile(r'(\d{3,}(?:\.\d+)?)\s*(?:元|块|¥)?')
_COUNT_RE = re.compile(r'(\d+)\s*(?:个|名|位)')
_PERCENT_RE = re.compile(r'(\d+)\s*%')


def _extract_name(message: str, prefixes: list[str]) -> str | None:
    """提取名称：匹配 '叫XX' / '是XX' / '姓X' / '客户XX' / '收货人XX' 等模式。
    支持完整公司名（最长30字，如'河南五建建设集团有限公司'12字）。
    """
    # 0) 优先匹配收货人/收件人（用户常粘贴快递地址）
    for label in ["收货人", "收件人", "客户名称", "客户名", "公司名称"]:
        m = re.search(rf'{label}[：:\s]*([^\s,，。、\n]{{1,30}})', message)
        if m:
            val = m.group(1).strip()
            # 排除明显非人名的内容
            if val and not re.match(r'^(?:信息|资料|录入|系统|暂无|无数据)$', val):
                return val

    for prefix in prefixes:
        m = re.search(rf'{prefix}[：:\s]*([^\s,，。、]{{1,30}})', message)
        if m:
            val = m.group(1).strip()
            # 排除前导非名称词：客户信息/客户资料/客户列表等不是名字
            if prefix in ("客户",) and re.match(r'^(?:信息|资料|列表|详情|数据|录入|录到|加到|存到|记到)', val):
                continue
            # 排除通用操作词（防止"把XX录入系统"→提取到"录入系统"）
            if re.match(r'^(?:录入|录到|加到|存到|记到|写到|创建|新建|添加|增加|新增|编辑|修改|更新|删除|移除|查询|查看|搜索|找|查找|导入|导出|系统|平台|资料|信息|数据|列表|详情|管理)$', val):
                continue
            return val
    # 匹配 "姓名：XXX" 或 "名字XXX" 或 "联系人XXX"
    m = re.search(r'(?:姓名|名字|联系人|称呼)[：:\s]*([^\s,，。、]{1,30})', message)
    if m:
        return m.group(1).strip()
    # 匹配 "XX的" 或 "XX说" 等模式（如 "李总的电话"）
    m = re.search(r'([^\s,，。、]{1,5})(?:的|说)[电话手机]', message)
    if m:
        return m.group(1).strip()
    # 匹配 "昵称：XXX"（微信名常当昵称，可作为备选名称）
    m = re.search(r'昵称[：:\s]*([^\s,，。、]{2,20})', message)
    if m:
        val = m.group(1).strip()
        if val and not re.match(r'^(?:建筑|工程|材料|建材)', val):
            return val
    # 匹配 "XX环氧磨石" / "XX环氧" — 提取人名/公司名前缀（2-3字人名）
    m = re.search(r'([\u4e00-\u9fff]{2,3})(?:环氧|磨石)', message)
    if m:
        val = m.group(1).strip()
        # 排除行业词
        if val and not re.match(r'^(?:建筑|无机|商业|工业|艺术|彩色|整体|环氧|无机磨)', val):
            return val
    # 兜底：手机号前面最近的中文名（同一行内），排除"电话/手机"等标签
    phone_m = re.search(r'([\u4e00-\u9fff]{2,10})[ \t]+1[3-9]\d{9}', message)
    if phone_m:
        val = phone_m.group(1).strip()
        # 排除"电话"/"手机"等标签词，且长度合理
        if val not in ("电话", "手机", "联系电话", "手机号", "号码", "微信", "昵称") and 2 <= len(val) <= 10:
            return val
    return None


def _extract_contact_person(message: str) -> str | None:
    """从消息中提取联系人姓名"""
    for label in ["收货人", "收件人", "联系人", "找", "联系"]:
        m = re.search(rf'{label}[：:\s]*([^\s,，。、\n]{{2,6}})', message)
        if m:
            return m.group(1).strip()
    # 匹配 "XX 电话/手机" 模式（仅同行，用[ \t]而非\s避免跨行）
    m = re.search(r'([^\s,，。、\n]{2,4})[ \t]*(?:电话|手机|联系方式)', message)
    if m:
        return m.group(1).strip()
    # 匹配 "XX(名字) 1XXXXXXXXXX(电话)" 模式（名字后紧跟手机号，仅同行）
    m = re.search(r'([\u4e00-\u9fff]{2,4}?)[ \t]+1[3-9]\d{9}', message)
    if m:
        name = m.group(1).strip()
        # 排除"电话/手机"等标签词 → 不是人名，跳过继续匹配
        if name not in ("电话", "手机", "联系电话", "手机号"):
            # 去掉可能的前缀关键词
            for kw in ('客户', '供应商', '甲方', '乙方'):
                if name.startswith(kw) and len(name) > len(kw):
                    name = name[len(kw):]
            if name and len(name) >= 2:
                return name
    # 匹配 "X总"/"X工"/"X经理" 模式（如 何总、刘工、王经理）— 优先于昵称
    m = re.search(r'([\u4e00-\u9fff]{1,4}(?:总|工|经理))', message)
    if m:
        val = m.group(1).strip()
        if val and len(val) >= 2:
            return val
    # 匹配 "昵称：XXX"（停在微信/电话/地区等字段前）
    m = re.search(r'昵称[：:\s]*([^\s,，。、\n]{2,10}?)(?:微信号|微信|电话|手机|地区|所在|地址|$)', message)
    if m:
        return m.group(1).strip()
    return None


def _extract_company_name(message: str) -> str | None:
    """从消息中提取公司名（XX有限公司/XX集团等）"""
    m = re.search(r'([\u4e00-\u9fff（）()\u00b7]{3,30}(?:有限公司|有限责任公司|股份有限公司|集团|建设|装饰|建材|科技|材料))', message)
    if m:
        return m.group(1).strip()
    return None


def _extract_address(message: str) -> str | None:
    """从消息中提取地址"""
    m = re.search(r'(?:地址|地点|位于|在)[：:\s]*([^\s,，。、]{3,30})', message)
    if m:
        return m.group(1).strip()
    return None


def _extract_amount(message: str) -> float | None:
    """提取金额"""
    m = _AMOUNT_RE.search(message)
    if m:
        return float(m.group(1)) * 10000
    m = _AMOUNT_PLAIN_RE.search(message)
    if m:
        return float(m.group(1))
    return None


def _extract_phone(message: str) -> str | None:
    m = _PHONE_RE.search(message)
    return m.group(0) if m else None


# ============================================================
# 供应商材料类型映射与提取
# ============================================================

_MATERIAL_MAP = {
    "水泥": "水泥", "泥": "水泥",
    "钢材": "钢材", "钢筋": "钢材", "钢": "钢材", "螺纹钢": "钢材",
    "砂": "砂石", "沙": "砂石", "沙子": "砂石", "黄沙": "砂石", "砂石": "砂石", "碎石": "砂石", "石子": "砂石",
    "砂浆": "砂浆", "拌合料": "砂浆",
    "涂料": "涂料", "油漆": "涂料", "乳胶漆": "涂料", "环氧": "涂料",
    "石材": "石材", "大理石": "石材", "花岗岩": "石材",
    "木材": "木材", "板材": "木材", "木方": "木材", "模板": "木材",
    "管材": "管线", "水管": "管线", "电线": "管线", "线缆": "管线", "电缆": "管线",
    "防水": "防水", "卷材": "防水", "防水膜": "防水",
    "混凝土": "混凝土", "商混": "混凝土",
    "瓷砖": "瓷砖", "地砖": "瓷砖", "墙砖": "瓷砖",
    "门窗": "门窗", "铝合金": "门窗", "断桥铝": "门窗",
    "五金": "五金", "螺丝": "五金", "配件": "五金",
    "保温": "保温", "岩棉": "保温", "保温板": "保温",
    "磨石": "磨石", "无机磨石": "磨石", "骨料": "磨石",
    "硅微粉": "硅微粉", "高岭土": "硅微粉", "高岭": "硅微粉",
    "建筑建材": "建筑建材", "建材": "建筑建材",
}


def _extract_supplier_category(message: str) -> tuple[str | None, str | None]:
    """从消息中提取材料类型和业务类型"""
    material_type = None
    # 按关键词长度倒序匹配，优先匹配长词（如"螺纹钢"优先于"钢"）
    for keyword in sorted(_MATERIAL_MAP.keys(), key=len, reverse=True):
        if keyword in message:
            material_type = _MATERIAL_MAP[keyword]
            break

    business_type = "建材商"
    if any(kw in message for kw in ["租赁", "设备"]):
        business_type = "设备租赁"
    elif any(kw in message for kw in ["运输", "物流"]):
        business_type = "运输商"
    elif any(kw in message for kw in ["劳务", "包工"]):
        business_type = "劳务商"

    return material_type, business_type


# ============================================================
# 动作执行器
# ============================================================

async def _execute_add_customer(conn, tenant_id: str, message: str, user: dict) -> dict:
    """录入新客户"""
    name = _extract_name(message, ["客户叫", "客户", "叫", "是", "姓"])
    phone = _extract_phone(message)
    contact_person = _extract_contact_person(message)
    company = _extract_company_name(message)

    if not name:
        # 如果有公司名但没直接客户名，用公司名当客户名
        if company:
            name = company
        else:
            return {"ok": False, "need": "客户名称", "hint": "请告诉我客户叫什么名字（或公司全称）"}

    # 如果提取到的名字太短且已有公司名，优先用公司名
    if company and len(name) < 4 and len(company) >= 4:
        name = company

    # 排除非人名的通用词（防止"老客户回单"→提取到"回单"）
    import re
    _GENERIC_NAMES = {'回单', '资料', '信息', '数据', '列表', '详情', '档案', '记录', '单据', '单子', '单'}
    if name in _GENERIC_NAMES:
        # 尝试从消息开头提取真实姓名（手机号前的2-3字中文名）
        m = re.match(r'^\s*([\u4e00-\u9fff]{2,4})\s', message)
        if m:
            name = m.group(1)
        else:
            return {"ok": False, "need": "客户名称", "hint": f"请提供客户姓名，例如：客户叫张三"}

    # 如果名称是"回单"等通用词、但消息开头有中文姓名+手机号，用那个
    if name in _GENERIC_NAMES and phone:
        m = re.match(r'^\s*([\u4e00-\u9fff]{2,4})\s+', message)
        if m:
            name = m.group(1)

    # Check duplicate
    existing = await conn.fetchval(
        "SELECT id FROM biz_customers WHERE tenant_id=$1 AND (name=$2 OR phone=$3)",
        tenant_id, name, phone or "",
    )
    if existing:
        return {"ok": False, "hint": f"客户 {name} 已存在（ID:{existing}），无需重复录入"}

    # 如果未提取到联系方式，默认名字作为联系人
    if not contact_person and len(name) <= 6:
        contact_person = name

    row = await conn.fetchrow(
        """INSERT INTO biz_customers (tenant_id, name, phone, contact_person, company, source, status, notes)
           VALUES ($1, $2, $3, $4, $5, 'chat', '咨询', $6)
           RETURNING id""",
        tenant_id, name, phone or "",
        contact_person or "",
        company or "",
        f"通过灵境对话录入 by {user.get('nickname', '')}",
    )
    result = {"ok": True, "action": "add_customer", "customer_name": name, "id": row["id"]}
    if phone:
        result["phone"] = phone
    if contact_person:
        result["contact_person"] = contact_person
    if company:
        result["company"] = company
    return result


async def _execute_add_invoice(conn, tenant_id: str, message: str, user: dict, file_contexts: list[dict] | None = None) -> dict:
    """录入发票 — 使用DeepSeek AI提取发票信息，失败时使用正则降级"""
    nickname = user.get("nickname", "") or user.get("name", "") or user.get("username", "")

    # 尝试用DeepSeek AI提取发票信息
    invoice_data = await _extract_invoice_ai(message)
    if not invoice_data:
        invoice_data = _extract_invoice_fallback(message)

    if not invoice_data or (not invoice_data.get("title") and not invoice_data.get("amount")):
        return {"ok": False, "need": "发票信息", "hint": "请告诉我发票信息，例如：发票号、抬头、金额。\n格式示例：\n- 「录一张发票，北京XX公司，材料款5000元」\n- 「收到一张进项发票，INV-2026-001，含税价11200」"}

    invoice_no = invoice_data.get("invoice_no", "").strip()
    title = (invoice_data.get("title") or "").strip()
    amount = float(invoice_data.get("amount", 0) or 0)
    tax_amount = float(invoice_data.get("tax_amount", 0) or 0)
    total_amount = float(invoice_data.get("total_amount", 0) or (amount + tax_amount))
    customer_name = (invoice_data.get("customer_name") or "").strip()
    supplier_name = (invoice_data.get("supplier_name") or "").strip()
    invoice_type = invoice_data.get("invoice_type", "purchase")

    # 从消息推断发票类型
    msg_lower = message.lower()
    if invoice_type == "unknown" or not invoice_type:
        if any(kw in msg_lower for kw in ["销项", "开票", "开给", "开出", "sales"]):
            invoice_type = "sales"
        else:
            invoice_type = "purchase"  # 默认进项

    # 自动生成发票号（如果AI未提取到）
    if not invoice_no:
        invoice_no = f"CHAT-{int(time.time())}"

    # 类别推断
    category = ""
    if any(kw in msg_lower for kw in ["材料", "原料", "采购", "物资"]):
        category = "材料款"
    elif any(kw in msg_lower for kw in ["工程", "施工", "劳务", "人工"]):
        category = "工程款"
    elif any(kw in msg_lower for kw in ["服务", "咨询", "设计", "技术服务"]):
        category = "服务费"
    elif any(kw in msg_lower for kw in ["运输", "物流", "运费", "运输费"]):
        category = "运输费"
    elif any(kw in msg_lower for kw in ["办公", "文具", "耗材"]):
        category = "办公费"

    # 用发票类型推断客户/供应商方向
    if invoice_type == "sales":
        if not customer_name and supplier_name:
            customer_name = supplier_name
            supplier_name = ""
    else:
        if not supplier_name and customer_name:
            supplier_name = customer_name
            customer_name = ""

    # 处理file_contexts中的附件
    file_ids = []
    if file_contexts:
        for fc in file_contexts:
            fid = fc.get("file_id") or fc.get("id")
            if fid:
                file_ids.append(fid)

    # 检查去重：同一租户下相同发票号只录入一次
    if not invoice_no.startswith("CHAT-"):
        existing = await conn.fetchval(
            "SELECT id FROM invoices WHERE tenant_id=$1 AND invoice_no=$2",
            tenant_id, invoice_no,
        )
        if existing:
            return {"ok": False, "hint": f"发票 {invoice_no} 已存在（ID:{existing}），无需重复录入"}

    try:
        row = await conn.fetchrow(
            """INSERT INTO invoices (tenant_id, invoice_no, invoice_type, title,
                customer_name, supplier_name, amount, tax_amount, total_amount,
                invoice_category, payment_status, status, file_ids, remarks,
                created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unpaid', 'issued',
                       $11, $12, NOW(), NOW())
               RETURNING id""",
            tenant_id,
            invoice_no,
            invoice_type,
            title[:300],
            customer_name[:200],
            supplier_name[:200],
            max(amount, 0.01),
            max(tax_amount, 0),
            max(total_amount, 0.01) if total_amount else (max(amount, 0.01) + max(tax_amount, 0)),
            category,
            json.dumps(file_ids, ensure_ascii=False) if file_ids else '[]',
            f"通过灵境对话录入 by {nickname}",
        )
        invoice_id = row["id"]
        logger.info(f"聊天录入发票: invoice_id={invoice_id}, no={invoice_no}, type={invoice_type}, title={title}, total={total_amount}")
        return {
            "ok": True,
            "action": "add_invoice",
            "invoice_id": invoice_id,
            "invoice_no": invoice_no,
            "invoice_type": invoice_type,
            "title": title,
            "amount": amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "customer_name": customer_name,
            "supplier_name": supplier_name,
            "category": category,
        }
    except Exception as e:
        logger.error(f"发票录入失败: {e}", exc_info=True)
        return {"ok": False, "hint": f"发票录入失败: {str(e)[:100]}"}


async def _extract_invoice_ai(message: str) -> dict | None:
    """使用DeepSeek AI提取发票信息"""
    import httpx
    prompt = f"""你是一个发票信息提取助手。从用户消息中提取发票信息，返回 JSON 格式（不要markdown代码块包裹）。

用户消息：{message[:800]}

请提取以下字段，没有的填 null：
{{
  "invoice_no": "发票号码（如 INV-2026-001），无则null",
  "title": "发票抬头/公司全称，无则null",
  "amount": 不含税金额（纯数字），无则null,
  "tax_amount": 税额（纯数字），无则null,
  "total_amount": 含税总金额（纯数字），无则null,
  "tax_rate": 税率（纯数字如13），无则null,
  "customer_name": "购买方名称（销项发票的客户），无则null",
  "supplier_name": "销售方名称（进项发票的商家），无则null",
  "invoice_type": "purchase 或 sales 或 unknown"
}}"""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 400,
                    "temperature": 0,
                },
            )
            if resp.status_code != 200:
                logger.warning(f"发票AI提取 API 失败: {resp.status_code}")
                return None
            content = resp.json()["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r"\n?```$", "", content)
            result = json.loads(content)
            if result.get("invoice_no") or result.get("title") or result.get("amount"):
                logger.info(f"发票AI提取成功: no={result.get('invoice_no')}, title={result.get('title')}")
                return result
            return None
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"发票AI提取异常: {e}")
        return None




# ============================================================
# 发票提取AI和降级方案（唯一，非重复）
# ============================================================
def _extract_invoice_fallback(message: str) -> dict | None:
    """正则降级提取发票信息"""
    result = {}

    # 发票号
    inv_no = re.search(r'(?:发票[号碼码]?[：:\s]*)?(INV[-–—]\d+|[A-Z]{2,4}[-–—]\d{4,})', message, re.IGNORECASE)
    if inv_no:
        result["invoice_no"] = inv_no.group(1)

    # 金额（含税/不含税）
    amt = re.search(r'(?:金额|价[款格]|合计|总价|总[计额]|含税|不含税)[：:\s]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)', message)
    if amt:
        result["amount"] = float(amt.group(1))

    # 含税总金额
    total = re.search(r'(?:含税[合总计]?[价额]?|价税合计|总[价额款])[：:\s]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)', message)
    if total:
        result["total_amount"] = float(total.group(1))

    # 税额
    tax = re.search(r'(?:税额|税[款额]|增值税)[：:\s]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)', message)
    if tax:
        result["tax_amount"] = float(tax.group(1))

    # 公司名/抬头
    company = re.search(r'(?:抬头|公司|企业|单位)[：:\s]*([\u4e00-\u9fff]{2,30}(?:有限|股份|集团|公司|厂|店)?)', message)
    if company:
        result["title"] = company.group(1).strip()

    # 客户/供应商
    customer = re.search(r'(?:客户|购买方|买方|收货方)[：:\s]*([\u4e00-\u9fff]{2,20}(?:有限|股份|集团|公司|厂|店)?)', message)
    if customer:
        result["customer_name"] = customer.group(1).strip()
    supplier = re.search(r'(?:供应商|销售方|卖方|供货方|商家)[：:\s]*([\u4e00-\u9fff]{2,20}(?:有限|股份|集团|公司|厂|店)?)', message)
    if supplier:
        result["supplier_name"] = supplier.group(1).strip()

    # 发票类型
    if re.search(r'(?:进项|收到|采购|purchase)', message, re.IGNORECASE):
        result["invoice_type"] = "purchase"
    elif re.search(r'(?:销项|开票|开出|开给|sales)', message, re.IGNORECASE):
        result["invoice_type"] = "sales"

    if result.get("invoice_no") or result.get("title") or result.get("amount"):
        return result
    return None



# ============================================================
# 业务执行函数（最终唯一副本）
# ============================================================
async def _execute_add_supplier(conn, tenant_id: str, message: str, user: dict) -> dict:
    """录入供应商"""
    name = _extract_name(message, ["供应商叫", "供应商", "供货商", "材料商", "叫", "是"])
    phone = _extract_phone(message)
    material_type, business_type = _extract_supplier_category(message)
    contact_person = _extract_contact_person(message)
    address = _extract_address(message)

    if not name:
        # 尝试从公司名中提取
        company = _extract_company_name(message)
        if company:
            name = company
        else:
            return {"ok": False, "need": "供应商名称", "hint": "请告诉我供应商叫什么名字（或公司全称）"}

    # 如果公司名比提取的名字更完整，用公司名
    company = _extract_company_name(message)
    if company and len(company) > len(name) and company != name:
        name = company

    # 去重检查
    existing = await conn.fetchval(
        "SELECT id FROM biz_suppliers WHERE tenant_id=$1 AND (name=$2 OR (phone=$3 AND phone!=''))",
        tenant_id, name, phone or "",
    )
    if existing:
        return {"ok": False, "hint": f"供应商 {name} 已存在（ID:{existing}），无需重复录入"}

    ext_id = f"chat_{int(datetime.now().timestamp())}"
    row = await conn.fetchrow(
        """INSERT INTO biz_suppliers
           (tenant_id, ext_id, name, phone, contact_person, material_type, business_type, address, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
           RETURNING id""",
        tenant_id, ext_id, name, phone or "",
        contact_person or "",
        material_type or "", business_type or "",
        address or "",
        f"通过灵境对话录入 by {user.get('nickname', '')}",
    )
    result = {"ok": True, "action": "add_supplier", "supplier_name": name, "id": row["id"]}
    if material_type:
        result["material_type"] = material_type
    if phone:
        result["phone"] = phone
    if contact_person:
        result["contact_person"] = contact_person
    if address:
        result["address"] = address
    return result


async def _execute_record_workers(conn, tenant_id: str, message: str, user: dict) -> dict:
    """记录工人到场"""
    # 提取项目（如果提到）
    project = await _resolve_project_for_action(conn, tenant_id, message)

    # 提取工人信息
    workers = []
    # 匹配 "3个大工2个小工" 或 "大工3个，小工2个"
    for m in re.finditer(r'(\d+)\s*(?:个|名|位)?\s*(大工|小工|师傅|工人|杂工|电工|水电工|油漆工|泥水工)', message):
        workers.append({"count": int(m.group(1)), "type": m.group(2)})
    for m in re.finditer(r'(大工|小工|师傅|工人|杂工|电工|水电工|油漆工|泥水工)\s*(\d+)\s*(?:个|名|位)?', message):
        workers.append({"count": int(m.group(2)), "type": m.group(1)})

    if not workers:
        # 尝试提取总数
        m = re.search(r'(\d+)\s*(?:个|名|位)?\s*(?:工人|人|师傅)', message)
        if m:
            workers.append({"count": int(m.group(1)), "type": "工人"})

    if not workers:
        return {"ok": False, "need": "工人数量", "hint": "请告诉我来了几个什么工种的工人"}

    # 提取日薪
    wage = None
    wm = re.search(r'(\d+)\s*(?:元|块|¥)?(?:/天|一天|每天|日薪)', message)
    if wm:
        wage = int(wm.group(1))

    total = sum(w["count"] for w in workers)
    project_id = project["id"] if project else None

    # 写入考勤
    now = datetime.now()
    for w in workers:
        for _ in range(w["count"]):
            await conn.execute(
                """INSERT INTO biz_attendance
                   (tenant_id, project_id, user_id, user_name, type, check_time, status)
                   VALUES ($1, $2, $3, $4, 'check_in', $5, 'normal')""",
                tenant_id, project_id,
                f"worker_{now.strftime('%Y%m%d')}_{w['type']}",
                w["type"], now,
            )

    result = {
        "ok": True, "action": "record_workers",
        "total": total, "workers": workers,
        "date": str(date.today()),
    }
    if project:
        result["project"] = project["name"]
    if wage:
        result["daily_wage"] = wage
    return result


async def _execute_submit_expense(conn, tenant_id: str, message: str, user: dict, file_contexts: list[dict] | None = None) -> dict:
    """记录费用/采购"""
    amount = _extract_amount(message)
    project = await _resolve_project_for_action(conn, tenant_id, message, user)

    if not amount:
        return {"ok": False, "need": "金额", "hint": "请告诉我花了多少钱"}

    # 推断类别 → 中文三分类
    category = "零星采购"  # 默认零星采购
    reason = message[:200]
    if any(kw in message for kw in ["材料", "水泥", "沙", "石", "钢", "砂浆", "原料", "矿", "粉",
                                       "骨料", "石子", "碎石", "沙子", "黄沙", "钢筋"]):
        category = "原料采购"
    elif any(kw in message for kw in ["临时工", "零工", "散工", "日结", "工钱", "人工费", "工资结算"]):
        category = "临时工零星支付"
    elif any(kw in message for kw in ["工具", "配件", "螺丝", "打磨", "切割", "设备", "五金", "办公",
                                       "劳保", "手套", "口罩", "安全帽"]):
        category = "零星采购"

    # PM角色：自己记录的直接通过，无需审批
    role = user.get("tenant_role", "")
    status = "approved" if role in ("project_manager", "owner", "admin") else "pending"
    applicant = user.get("nickname", "") or user.get("name", "")

    # 提取附件中的单据图片 file_ids
    file_ids = []
    supplier_name = ""
    material_desc = ""
    expense_date = None
    if file_contexts:
        for fc in file_contexts:
            if fc.get("type") == "image":
                file_ids.append(fc["file_id"])
                # 尝试从 ai_tags 读取单据识别结果
                tags = fc.get("ai_tags") or {}
                if isinstance(tags, str):
                    try: tags = json.loads(tags)
                    except (json.JSONDecodeError, TypeError): tags = {}
                if tags.get("is_receipt"):
                    if not supplier_name and tags.get("supplier"):
                        supplier_name = tags["supplier"]
                    if not material_desc and tags.get("material"):
                        material_desc = tags["material"]
                    if not expense_date and tags.get("date"):
                        expense_date = tags["date"]
                    if not amount and tags.get("amount"):
                        amount = float(tags["amount"])

    row = await conn.fetchrow(
        """INSERT INTO biz_finance
           (tenant_id, project_id, type, category, amount, applicant_name, status,
            reason, file_ids, supplier_name, material_desc, expense_date)
           VALUES ($1, $2, 'expense', $3, $4, $5, $6,
                   $7, $8, $9, $10, $11)
           RETURNING id""",
        tenant_id, project["id"] if project else None,
        category, amount, applicant, status, reason,
        json.dumps(file_ids, ensure_ascii=False) if file_ids else None,
        supplier_name[:200], material_desc[:500],
        expense_date,
    )
    result = {
        "ok": True, "action": "submit_expense",
        "amount": amount, "category": category, "id": row["id"],
        "file_ids": file_ids,
    }
    if project:
        result["project"] = project["name"]
        # 自动从合同金额扣减
        deduction = await _deduct_from_project(conn, project["id"], amount)
        if deduction:
            result["deduction"] = deduction
    if supplier_name:
        result["supplier"] = supplier_name
    return result


async def _execute_fund_request(conn, tenant_id: str, message: str, user: dict) -> dict:
    """备用金申请"""
    amount = _extract_amount(message)
    project = await _resolve_project_for_action(conn, tenant_id, message, user)

    if not amount:
        return {"ok": False, "need": "金额", "hint": "请告诉我需要申请多少备用金"}

    row = await conn.fetchrow(
        """INSERT INTO biz_finance
           (tenant_id, project_id, type, category, amount, applicant_name, status, reason)
           VALUES ($1, $2, 'fund_application', 'reserve_fund', $3, $4, 'pending', $5)
           RETURNING id""",
        tenant_id, project["id"] if project else None,
        amount, user.get("nickname", ""), message[:200],
    )
    result = {
        "ok": True, "action": "fund_request",
        "amount": amount, "id": row["id"],
    }
    if project:
        result["project"] = project["name"]
        deduction = await _deduct_from_project(conn, project["id"], amount)
        if deduction:
            result["deduction"] = deduction
    return result


async def _execute_create_project(conn, tenant_id: str, message: str, user: dict) -> dict:
    """创建新项目"""
    name = _extract_name(message, ["项目叫", "工程叫", "项目", "工程", "工地"])
    if not name:
        return {"ok": False, "need": "项目名称", "hint": "请告诉我项目叫什么名字"}

    amount = _extract_amount(message)
    location = None
    lm = re.search(r'(?:在|地[点址]|位于)[：:\s]*([^\s,，。、]{2,20})', message)
    if lm:
        location = lm.group(1)

    customer = _extract_name(message, ["甲方", "客户", "业主"])

    row = await conn.fetchrow(
        """INSERT INTO biz_projects
           (tenant_id, name, customer, contract_amount, location, status, manager_name)
           VALUES ($1, $2, $3, $4, $5, 'not_started', $6)
           RETURNING id""",
        tenant_id, name, customer or "", amount or 0,
        location or "", user.get("nickname", ""),
    )
    result = {"ok": True, "action": "create_project", "project_name": name, "id": row["id"]}
    if amount:
        result["contract_amount"] = amount
    if location:
        result["location"] = location
    return result


async def _execute_update_progress(conn, tenant_id: str, message: str, user: dict) -> dict:
    """更新项目进度"""
    project = await _resolve_project_for_action(conn, tenant_id, message)
    if not project:
        return {"ok": False, "need": "项目名称", "hint": "请告诉我要更新哪个项目的进度"}

    m = _PERCENT_RE.search(message)
    progress = int(m.group(1)) if m else None

    if progress is not None:
        await conn.execute(
            "UPDATE biz_projects SET progress=$1, updated_at=NOW() WHERE id=$2",
            min(progress, 100), project["id"],
        )
        return {
            "ok": True, "action": "update_progress",
            "project": project["name"], "progress": progress,
        }

    # 如果没有明确百分比，检测是否有"完工"
    if any(kw in message for kw in ["完工", "完成", "做完", "结束"]):
        await conn.execute(
            "UPDATE biz_projects SET progress=100, status='completed', updated_at=NOW() WHERE id=$1",
            project["id"],
        )
        return {
            "ok": True, "action": "update_progress",
            "project": project["name"], "progress": 100, "status": "completed",
        }

    return {"ok": False, "need": "进度数值", "hint": "请告诉我进度百分比，或者是否已完工"}


async def _execute_advance_customer(conn, tenant_id: str, message: str, user: dict) -> dict:
    """推进客户阶段 / 设置客户状态（9种状态）"""
    import re
    
    # 匹配客户名（支持模糊匹配）
    customers = await conn.fetch(
        "SELECT id, name, status, project_status FROM biz_customers WHERE tenant_id=$1",
        tenant_id,
    )
    target = None
    for c in customers:
        if c["name"] in message:
            target = c
            break
    if not target:
        # 尝试从消息中提取客户名（2-6字）
        m = re.search(r'(?:客户|把|给|对)\s*([\u4e00-\u9fff]{2,6})\s*(?:的|状态|阶段)', message)
        if m:
            for c in customers:
                if c["name"] == m.group(1):
                    target = c
                    break

    if not target:
        return {"ok": False, "hint": "请告诉我是哪个客户（如「把陈涵的状态改为洽谈中」）"}

    # 9种客户状态映射
    _STAGE_KEYWORDS = [
        ("无效客户",   ["无效", "删除", "取消", "放弃", "不再跟进"]),
        ("休眠客户",   ["休眠", "暂停", "搁置", "延后", "先放着"]),
        ("质保中",     ["质保", "保修", "维保", "维护中"]),
        ("已交付",     ["交付", "移交", "完工", "完成", "验收", "竣工", "做完"]),
        ("施工中",     ["施工", "开工", "进场", "在做了", "施工中", "正在做"]),
        ("已签约",     ["签约", "签了合同", "成交", "签单", "合同签了", "签了"]),
        ("洽谈中",     ["洽谈", "面谈", "见面", "拜访", "约谈", "谈判", "谈", "碰面"]),
        ("待跟进",     ["跟进", "联系", "接触", "聊了", "已联系", "待跟进"]),
        ("咨询中",     ["咨询", "询问", "了解", "感兴趣", "询价", "新客户"]),
    ]

    # 先检查是否有明确的"状态改为XXX"指令
    explicit = re.search(r'状态\s*(?:改为|改成|变为|更新为|设置|设|修改为?)\s*([\u4e00-\u9fff]{2,4})', message)
    if explicit:
        target_status = explicit.group(1)
        for status, _ in _STAGE_KEYWORDS:
            if target_status in status or status in target_status:
                new_status = status
                break
        else:
            new_status = None
    else:
        new_status = None
        for status, keywords in _STAGE_KEYWORDS:
            if any(kw in message for kw in keywords):
                new_status = status
                break

    if not new_status:
        status_list = "、".join(s for s, _ in _STAGE_KEYWORDS)
        return {"ok": False, "hint": f"没有识别到明确的状态变化。支持的状态：{status_list}\n示例：把陈涵的状态改为洽谈中"}

    if new_status == target.get("status"):
        return {"ok": False, "hint": f"客户 {target['name']} 当前已是「{new_status}」状态"}

    await conn.execute(
        "UPDATE biz_customers SET status=$1, updated_at=NOW() WHERE id=$2",
        new_status, target["id"],
    )

    status_emoji = {"咨询中":"📞","待跟进":"📋","洽谈中":"🤝","已签约":"📝",
                    "施工中":"🏗️","已交付":"✅","质保中":"🔧","休眠客户":"💤","无效客户":"🚫"}

    return {
        "ok": True, "action": "advance_customer",
        "customer_name": target["name"],
        "old_stage": target.get("status") or "无",
        "new_stage": new_status,
        "display": f"{status_emoji.get(new_status, '')} {target['name']}: {target.get('status') or '无状态'} → {new_status}",
    }


# ============================================================
# 团队管理动作
# ============================================================

_ROLE_MAP = {
    "工人": "worker", "项目经理": "project_manager",
    "管理员": "admin", "技术员": "technician", "客户": "customer",
}
_ROLE_NAMES = {v: k for k, v in _ROLE_MAP.items()}
_WORKER_TYPES = ["大工", "小工", "电工", "水电工", "油漆工", "泥水工", "杂工", "师傅", "技工", "木工", "钢筋工", "焊工", "瓦工"]
_WAGE_RE = re.compile(r'(\d+)\s*(?:元|块|¥)?(?:\s*/?\s*天|一天|每天|日薪)?')


def _extract_new_password(message: str) -> str | None:
    """从消息中提取新密码（明文）"""
    for sep in ["改成", "改为", "改", "设为", "设置", "重置", "修改成", "重置成", "为"]:
        m = re.search(rf'(?:密码|登录密码).*{sep}[：:\s]*(\S{{4,32}})', message)
        if m:
            pw = m.group(1).strip()
            # 去掉开头多余的词（"是"/"为"/"："）
            pw = re.sub(r'^[是为：:]\s*', '', pw)
            # 去掉末尾标点
            if pw and pw[-1] in "，。,.!！？?；;、":
                pw = pw[:-1]
            if 4 <= len(pw) <= 32:
                return pw
    # 备选: "新密码是xxx" / "密码是xxx"
    for kw in ["新密码", "密码是"]:
        m = re.search(rf'{kw}[：:\s]*(\S{{4,32}})', message)
        if m:
            pw = m.group(1).strip()
            pw = re.sub(r'^[是为：:]\s*', '', pw)
            if pw and pw[-1] in "，。,.!！？?；;、":
                pw = pw[:-1]
            if 4 <= len(pw) <= 32:
                return pw
    return None


async def _resolve_member(conn, tenant_id: str, message: str) -> dict | None:
    """从消息中识别团队成员，返回 {user_id, name, role, ext_data} 或 None"""
    members = await conn.fetch(
        "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1",
        tenant_id,
    )
    # 先尝试精确名字匹配
    for m in members:
        if m["name"] and len(m["name"]) >= 2 and m["name"] in message:
            ext = json.loads(m["ext_data"]) if isinstance(m["ext_data"], str) else (m["ext_data"] or {})
            return {"user_id": m["user_id"], "name": m["name"], "role": m["role"], "ext_data": ext}
    # 再尝试 user_id 匹配
    for m in members:
        if m["user_id"] in message:
            ext = json.loads(m["ext_data"]) if isinstance(m["ext_data"], str) else (m["ext_data"] or {})
            return {"user_id": m["user_id"], "name": m["name"], "role": m["role"], "ext_data": ext}
    # 如果只有一个 member 角色（新加入的成员），自动识别
    pending = [m for m in members if m["role"] == "member"]
    if len(pending) == 1:
        m = pending[0]
        ext = json.loads(m["ext_data"]) if isinstance(m["ext_data"], str) else (m["ext_data"] or {})
        return {"user_id": m["user_id"], "name": m["name"], "role": m["role"], "ext_data": ext}
    return None


async def _resolve_member_by_id(conn, tenant_id: str, user_id: str) -> dict | None:
    """通过 user_id 查找成员"""
    m = await conn.fetchrow(
        "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
        tenant_id, user_id,
    )
    if m:
        ext = json.loads(m["ext_data"]) if isinstance(m["ext_data"], str) else (m["ext_data"] or {})
        return {"user_id": m["user_id"], "name": m["name"], "role": m["role"], "ext_data": ext}
    return None


async def _execute_assign_role(conn, tenant_id: str, message: str, user: dict) -> dict:
    """设定团队成员角色"""
    # 权限检查
    if user.get("tenant_role") not in ("owner", "admin"):
        return {"ok": False, "hint": "只有管理员才能分配角色"}

    # 识别目标角色
    target_role_code = None
    target_role_name = None
    for cn, en in _ROLE_MAP.items():
        if cn in message:
            target_role_code = en
            target_role_name = cn
            break

    # 识别目标用户
    member = await _resolve_member(conn, tenant_id, message)

    # 如果是工人角色，检查是否同时提供了工种和日薪
    worker_type = None
    daily_wage = None
    for wt in _WORKER_TYPES:
        if wt in message:
            worker_type = wt
            break
    wm = _WAGE_RE.search(message)
    if wm:
        val = int(wm.group(1))
        if 50 <= val <= 5000:  # 合理日薪范围
            daily_wage = val

    # 情况1：提供了工种和日薪但没有明确角色 → 这是对工人的补充信息
    if worker_type and daily_wage and not target_role_code:
        target_role_code = "worker"
        target_role_name = "工人"

    if not target_role_code:
        return {"ok": False, "hint": "请告诉我要设定什么角色（工人、项目经理、管理员、技术员）"}

    if not member:
        # 查询最近加入的待分配成员
        recent = await conn.fetch(
            """SELECT target_user_id, target_user_name
               FROM tenant_notifications
               WHERE tenant_id=$1 AND type='new_member' AND status='pending'
               ORDER BY created_at DESC LIMIT 5""",
            tenant_id,
        )
        if len(recent) == 1:
            member = await _resolve_member_by_id(conn, tenant_id, recent[0]["target_user_id"])
        elif recent:
            names = "、".join(r["target_user_name"] for r in recent)
            return {"ok": False, "hint": f"当前有多个待分配成员：{names}，请指明是哪一位"}
        else:
            return {"ok": False, "hint": "请告诉我要设定哪个成员的角色"}

    # 执行角色更新（先设角色，工人详情可后补）
    ext_data = member.get("ext_data") or {}
    if target_role_code == "worker":
        if worker_type:
            ext_data["worker_type"] = worker_type
        if daily_wage:
            ext_data["daily_wage"] = str(daily_wage)

    await conn.execute(
        "UPDATE tenant_users SET role=$1, ext_data=$2, updated_at=NOW() WHERE tenant_id=$3 AND user_id=$4",
        target_role_code, json.dumps(ext_data, ensure_ascii=False), tenant_id, member["user_id"],
    )
    # 标记通知为已处理
    await conn.execute(
        "UPDATE tenant_notifications SET status='delivered' WHERE tenant_id=$1 AND target_user_id=$2 AND type='new_member' AND status='pending'",
        tenant_id, member["user_id"],
    )

    result = {
        "ok": True, "action": "assign_role",
        "member_name": member["name"],
        "role": target_role_name,
    }
    if worker_type:
        result["worker_type"] = worker_type
    if daily_wage:
        result["daily_wage"] = daily_wage
    # 工人角色缺少详情时，提示补充但角色已生效
    if target_role_code == "worker" and (not worker_type or not daily_wage):
        missing = []
        if not worker_type:
            missing.append("什么工种（如大工、小工、电工等）")
        if not daily_wage:
            missing.append("多少钱一天")
        result["need"] = "worker_details"
        result["hint"] = f"已将{member['name']}设为工人。还需要补充：{'，'.join(missing)}"
    return result


async def _execute_bind_project(conn, tenant_id: str, message: str, user: dict) -> dict:
    """绑定成员到项目"""
    if user.get("tenant_role") not in ("owner", "admin", "project_manager"):
        return {"ok": False, "hint": "只有管理员或项目经理才能分配项目"}

    member = await _resolve_member(conn, tenant_id, message)
    project = await _resolve_project_for_action(conn, tenant_id, message)

    if not member:
        return {"ok": False, "hint": "请告诉我要安排哪个成员到项目"}
    if not project:
        return {"ok": False, "hint": "请告诉我要安排到哪个项目"}

    # 检查一人一项目约束
    ext_data = member.get("ext_data") or {}
    current_pid = ext_data.get("project_id")
    if current_pid and current_pid != project["id"]:
        cur_proj = await conn.fetchval("SELECT name FROM biz_projects WHERE id=$1", current_pid)
        return {
            "ok": False,
            "hint": f"{member['name']}当前绑定在「{cur_proj or '未知项目'}」，需要先解绑才能安排到新项目。要解绑吗？",
        }

    # 执行绑定
    ext_data["project_id"] = project["id"]
    ext_data["project_name"] = project["name"]
    await conn.execute(
        "UPDATE tenant_users SET ext_data=$1, updated_at=NOW() WHERE tenant_id=$2 AND user_id=$3",
        json.dumps(ext_data, ensure_ascii=False), tenant_id, member["user_id"],
    )
    # 如果是项目经理，同时更新项目表
    if member["role"] == "project_manager":
        await conn.execute(
            "UPDATE biz_projects SET manager_user_id=$1, manager_name=$2, updated_at=NOW() WHERE id=$3",
            member["user_id"], member["name"], project["id"],
        )

    return {
        "ok": True, "action": "bind_project",
        "member_name": member["name"],
        "project_name": project["name"],
        "role": _ROLE_NAMES.get(member["role"], member["role"]),
    }


async def _execute_unbind_project(conn, tenant_id: str, message: str, user: dict) -> dict:
    """从项目解绑成员"""
    if user.get("tenant_role") not in ("owner", "admin", "project_manager"):
        return {"ok": False, "hint": "只有管理员或项目经理才能调离成员"}

    member = await _resolve_member(conn, tenant_id, message)
    if not member:
        return {"ok": False, "hint": "请告诉我要调离哪个成员"}

    ext_data = member.get("ext_data") or {}
    current_pid = ext_data.get("project_id")
    if not current_pid:
        return {"ok": False, "hint": f"{member['name']}当前没有绑定任何项目"}

    project_name = ext_data.get("project_name", "")
    if not project_name:
        pn = await conn.fetchval("SELECT name FROM biz_projects WHERE id=$1", current_pid)
        project_name = pn or "未知项目"

    ext_data.pop("project_id", None)
    ext_data.pop("project_name", None)
    await conn.execute(
        "UPDATE tenant_users SET ext_data=$1, updated_at=NOW() WHERE tenant_id=$2 AND user_id=$3",
        json.dumps(ext_data, ensure_ascii=False), tenant_id, member["user_id"],
    )
    if member["role"] == "project_manager":
        await conn.execute(
            "UPDATE biz_projects SET manager_user_id=NULL, manager_name='', updated_at=NOW() WHERE id=$1 AND manager_user_id=$2",
            current_pid, member["user_id"],
        )

    return {
        "ok": True, "action": "unbind_project",
        "member_name": member["name"],
        "project_name": project_name,
    }


async def _execute_self_checkin(conn, tenant_id: str, message: str, user: dict) -> dict:
    """工人/项目经理自助打卡"""
    username = user.get("code", "").replace("u_", "")
    if not username:
        return {"ok": False, "hint": "无法识别您的身份"}

    tu = await conn.fetchrow(
        "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
        tenant_id, username,
    )
    if not tu:
        return {"ok": False, "hint": "您不在当前团队中"}

    ext = json.loads(tu["ext_data"]) if isinstance(tu["ext_data"], str) else (tu["ext_data"] or {})
    project_id = ext.get("project_id")
    project_name = ext.get("project_name", "")

    if not project_id:
        return {"ok": False, "hint": "您还没有绑定项目，请联系管理员安排项目后再打卡"}

    # 判断上班/下班
    check_type = "check_in"
    if any(kw in message for kw in ["下班", "收工", "走了", "回去了", "下工"]):
        check_type = "check_out"

    # 防重复打卡
    existing = await conn.fetchval(
        """SELECT id FROM biz_attendance
           WHERE tenant_id=$1 AND user_id=$2 AND project_id=$3
           AND type=$4 AND check_time::date = CURRENT_DATE""",
        tenant_id, username, project_id, check_type,
    )
    if existing:
        type_name = "上班" if check_type == "check_in" else "下班"
        return {"ok": False, "hint": f"您今天已经打过{type_name}卡了"}

    now = datetime.now()
    await conn.execute(
        """INSERT INTO biz_attendance
           (tenant_id, project_id, user_id, user_name, type, check_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'normal')""",
        tenant_id, project_id, username, tu["name"], check_type, now,
    )

    type_name = "上班" if check_type == "check_in" else "下班"
    return {
        "ok": True, "action": "self_checkin",
        "check_type": type_name,
        "user_name": tu["name"],
        "project_name": project_name,
        "time": now.strftime("%H:%M"),
    }


# ============================================================
# 密码管理动作
# ============================================================

async def _execute_reset_member_password(conn, tenant_id: str, message: str, user: dict) -> dict:
    """管理员/owner 修改团队成员的密码"""
    if user.get("tenant_role") not in ("owner", "admin"):
        return {"ok": False, "hint": "只有管理员才能修改团队成员的密码"}

    member = await _resolve_member(conn, tenant_id, message)
    if not member:
        return {"ok": False, "hint": "请告诉我要修改哪个成员的密码"}

    new_password = _extract_new_password(message)
    if not new_password:
        return {"ok": False, "need": "新密码", "hint": "请告诉我新密码是什么（4-32位字符）"}
    if len(new_password) < 4:
        return {"ok": False, "hint": "密码至少需要4个字符"}

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    new_token = secrets.token_urlsafe(48)

    await conn.execute(
        "UPDATE users SET password_hash=$1, token=$2 WHERE username=$3",
        new_hash, new_token, member["user_id"],
    )

    return {
        "ok": True, "action": "reset_member_password",
        "member_name": member["name"],
        "new_password": new_password,
    }


async def _execute_rename_member(conn, tenant_id: str, message: str, user: dict) -> dict:
    """修改团队成员名称"""
    if user.get("tenant_role") not in ("owner", "admin"):
        return {"ok": False, "hint": "只有管理员才能修改成员名称"}

    # 从消息中提取旧名称和新名称
    # 【重要】带"把/将/给"前缀的格式优先匹配，避免\S+贪婪吞掉"把技术员liushi"中的把字
    rename_match = re.search(r'(?:把|将|给)\s*(\S+?)\s*(?:改[成为回]|改为|改成|改回|名字改[成为回]|更名为|改名[为成回])\s*(\S+)', message)
    if not rename_match:
        rename_match = re.search(r'(\S+)\s*(?:改成|改为|改名为|改回|名字改成|更名为|改名[为成回])\s*(\S+)', message)
    if not rename_match:
        return {"ok": False, "hint": "请按「把旧名改成新名」的格式告诉我"}

    old_name = rename_match.group(1).strip()
    new_name = rename_match.group(2).strip()

    # 清理角色前缀（用户可能说"把技术员liushi改成刘施"）
    _KNOWN_ROLES = {"技术员", "工人", "项目经理", "管理员", "项目管理员"}
    for role in _KNOWN_ROLES:
        if old_name.startswith(role):
            old_name = old_name[len(role):].strip()
            break

    if not new_name or len(new_name) < 2 or len(new_name) > 20:
        return {"ok": False, "hint": "新名称需要2-20个字符"}

    # 查找成员（用名称或user_id）
    member = await conn.fetchrow(
        "SELECT user_id, name FROM tenant_users WHERE tenant_id=$1 AND name=$2",
        tenant_id, old_name,
    )
    if not member:
        member = await conn.fetchrow(
            "SELECT user_id, name FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, old_name,
        )
    if not member:
        return {"ok": False, "hint": f"团队中没有找到「{old_name}」，请确认名称正确"}

    old_real_name = member["name"]
    await conn.execute(
        "UPDATE tenant_users SET name=$1, updated_at=NOW() WHERE tenant_id=$2 AND user_id=$3",
        new_name, tenant_id, member["user_id"],
    )

    return {
        "ok": True, "action": "rename_member",
        "member_name": old_real_name,
        "new_name": new_name,
        "user_id": member["user_id"],
    }


async def _execute_change_own_password(conn, tenant_id: str, message: str, user: dict) -> dict:
    """当前用户修改自己的登录密码"""
    username = user.get("code", "").replace("u_", "")
    if not username:
        return {"ok": False, "hint": "无法识别您的账号，请先登录"}

    new_password = _extract_new_password(message)
    if not new_password:
        return {"ok": False, "need": "新密码", "hint": "请告诉我您的新密码是什么（4-32位字符）"}
    if len(new_password) < 4:
        return {"ok": False, "hint": "密码至少需要4个字符"}

    # 检查旧密码（如果用户提供了）
    old_password = None
    for prefix in ["旧密码", "原密码", "当前密码", "现在的密码", "原来密码"]:
        m = re.search(rf'{prefix}[：:\s]*(\S{{4,32}})', message)
        if m:
            old_password = m.group(1).strip()
            if old_password and old_password[-1] in "，。,.!！？?；;、":
                old_password = old_password[:-1]
            break

    if old_password:
        row = await conn.fetchrow("SELECT password_hash FROM users WHERE username=$1", username)
        if not bcrypt.checkpw(old_password.encode(), row["password_hash"].encode()):
            return {"ok": False, "hint": "旧密码不正确，无法修改密码。请确认后重试"}

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    new_token = secrets.token_urlsafe(48)

    await conn.execute(
        "UPDATE users SET password_hash=$1, token=$2 WHERE username=$3",
        new_hash, new_token, username,
    )

    return {
        "ok": True, "action": "change_own_password",
        "nickname": user.get("nickname", ""),
    }


# ============================================================
# 工具函数
# ============================================================

async def _deduct_from_project(conn, project_id: int, amount: float):
    """从项目合同金额中扣除支出，更新 actual_cost"""
    if not project_id or amount <= 0:
        return None
    row = await conn.fetchrow(
        "UPDATE biz_projects SET actual_cost = actual_cost + $1, updated_at = NOW() WHERE id = $2 RETURNING contract_amount, actual_cost",
        amount, project_id,
    )
    if row:
        remaining = float(row["contract_amount"] or 0) - float(row["actual_cost"] or 0)
        return {
            "contract_amount": float(row["contract_amount"] or 0),
            "actual_cost": float(row["actual_cost"] or 0),
            "remaining": remaining,
            "alert": remaining < 0,
        }
    return None


# ============================================================
# 项目解析
# ============================================================

async def _resolve_project_for_action(conn, tenant_id: str, message: str, user: dict | None = None) -> dict | None:
    """从消息中识别项目，返回 {id, name} 或 None。
    优先消息中显式提到项目名 → PM绑定唯一项目 → 仅一个活跃项目 → None
    """
    projects = await conn.fetch(
        "SELECT id, name, location FROM biz_projects WHERE tenant_id=$1 AND status != 'completed'",
        tenant_id,
    )
    for p in projects:
        if p["name"] and p["name"] in message:
            return {"id": p["id"], "name": p["name"]}
        if p["location"] and len(p["location"]) >= 2 and p["location"] in message:
            return {"id": p["id"], "name": p["name"]}

    # PM/工人：名字匹配项目经理 → 自动关联该项目
    if user and len(projects) > 1:
        username = user.get("nickname", "") or user.get("name", "")
        if username:
            for p in projects:
                row = await conn.fetchrow("SELECT manager_name FROM biz_projects WHERE id=$1", p["id"])
                manager = (row["manager_name"] or "") if row else ""
                if username in manager or manager in username:
                    return {"id": p["id"], "name": p["name"]}

    # 只有一个活跃项目 → 默认关联
    if len(projects) == 1:
        return {"id": projects[0]["id"], "name": projects[0]["name"]}

    # 多项目但未绑定 → 取最近更新的活跃项目（采购扣款需要项目）
    if len(projects) > 1:
        latest = await conn.fetchrow(
            """SELECT id, name FROM biz_projects 
               WHERE tenant_id=$1 AND status != 'completed' 
               ORDER BY updated_at DESC LIMIT 1""",
            tenant_id,
        )
        if latest:
            return {"id": latest["id"], "name": latest["name"]}

    return None


async def _execute_approve_finance(conn, tenant_id: str, message: str, user: dict) -> dict:
    """审批通过费用"""
    amount = _extract_amount(message)
    applicant = _extract_name(message, ["的", "申请人", "人"])
    
    where = "tenant_id=$1 AND status='pending'"
    params: list = [tenant_id]
    if amount:
        params.append(amount)
        where += f" AND abs(amount - ${len(params)}) < 0.01"
    if applicant:
        params.append(f"%{applicant}%")
        where += f" AND applicant_name ILIKE ${len(params)}"

    row = await conn.fetchrow(
        f"SELECT id, amount, applicant_name, reason FROM biz_finance WHERE {where} ORDER BY created_at DESC LIMIT 1",
        *params,
    )
    if not row:
        return {"ok": False, "hint": "未找到匹配的待审批申请"}

    await conn.execute(
        "UPDATE biz_finance SET status='approved', approved_by=$2, approved_at=NOW() WHERE id=$1",
        row["id"], user.get("nickname", ""),
    )

    # 标记关联待办已完成
    await conn.execute(
        "UPDATE todo_items SET status='done', done_at=NOW(), done_by=$2 WHERE ref_id=$1 AND ref_type='finance' AND status='pending'",
        row["id"], user.get("nickname", ""),
    )

    return {"ok": True, "action": "approve_finance", "finance_id": row["id"], "amount": float(row["amount"]), "applicant": row["applicant_name"]}


async def _execute_reject_finance(conn, tenant_id: str, message: str, user: dict) -> dict:
    """驳回费用"""
    amount = _extract_amount(message)
    applicant = _extract_name(message, ["的", "申请人", "人"])

    where = "tenant_id=$1 AND status='pending'"
    params: list = [tenant_id]
    if amount:
        params.append(amount)
        where += f" AND abs(amount - ${len(params)}) < 0.01"
    if applicant:
        params.append(f"%{applicant}%")
        where += f" AND applicant_name ILIKE ${len(params)}"

    row = await conn.fetchrow(
        f"SELECT id, amount, applicant_name FROM biz_finance WHERE {where} ORDER BY created_at DESC LIMIT 1",
        *params,
    )
    if not row:
        return {"ok": False, "hint": "未找到匹配的待审批申请"}

    await conn.execute(
        "UPDATE biz_finance SET status='rejected', approved_by=$2, approved_at=NOW() WHERE id=$1",
        row["id"], user.get("nickname", ""),
    )
    await conn.execute(
        "UPDATE todo_items SET status='done', done_at=NOW(), done_by=$2 WHERE ref_id=$1 AND ref_type='finance' AND status='pending'",
        row["id"], user.get("nickname", ""),
    )

    return {"ok": True, "action": "reject_finance", "finance_id": row["id"], "amount": float(row["amount"]), "applicant": row["applicant_name"]}


async def _execute_complete_todo(conn, tenant_id: str, message: str, user: dict) -> dict:
    """完成待办"""
    # 提取待办ID
    m = re.search(r"完成\s*(\d+)", message)
    todo_id = None
    if m:
        todo_id = int(m.group(1))
        row = await conn.fetchrow(
            "SELECT id, title FROM todo_items WHERE id=$1 AND tenant_id=$2 AND status='pending'",
            todo_id, tenant_id,
        )
    else:
        # 按title模糊匹配最近的待办
        row = await conn.fetchrow(
            "SELECT id, title FROM todo_items WHERE tenant_id=$1 AND status='pending' ORDER BY priority DESC, created_at DESC LIMIT 1",
            tenant_id,
        )

    if not row:
        return {"ok": False, "hint": "没有待处理的事项"}

    await conn.execute(
        "UPDATE todo_items SET status='done', done_at=NOW(), done_by=$2 WHERE id=$1",
        row["id"], user.get("nickname", ""),
    )
    return {"ok": True, "action": "complete_todo", "todo_id": row["id"], "title": row["title"]}


async def _execute_generate_contract(conn, tenant_id: str, message: str, user: dict, file_contexts: list[dict] | None = None) -> dict:
    """基于模板生成合同"""
    from services.contract_service import generate_contract_content
    # 提取项目名
    project = await _resolve_project_for_action(conn, tenant_id, message)
    project_name = project["name"] if project else ""
    
    # 提取其他参数
    party_a = _extract_name(message, ["甲方", "发包方", "发包人", "业主"])
    party_b = _extract_name(message, ["乙方", "承包方", "承包人", "施工方", "我方", "公司"])
    if not party_b:
        # 默认乙方为当前公司
        rows = await conn.fetchrow("SELECT company_name FROM tenants WHERE tenant_id=$1", tenant_id)
        if rows: party_b = rows["company_name"]
    amount = _extract_amount(message)
    address = ""
    m = re.search(r'(?:地[点址]|在|位于)[：:\s]*([^\s,，。、]{3,30})', message)
    if m: address = m.group(1)
    scope = message[:200]  # 工程内容

    # 选模板
    template = "施工合同"
    for k in ["地坪", "地坪工程"]:
        if k in message: template = "地坪工程合同"; break

    content = await generate_contract_content(
        template, project_name=project_name, party_a=party_a or "", party_b=party_b or "",
        amount=amount or 0, address=address, scope=scope,
    )
    if not content:
        return {"ok": False, "hint": f"未找到「{template}」模板，可用：施工合同、地坪工程合同"}

    # 写 biz_contracts
    row = await conn.fetchrow(
        """INSERT INTO biz_contracts (tenant_id, project_id, title, party_a, party_b, amount, content, address, scope, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING id""",
        tenant_id, project["id"] if project else None,
        f"{project_name}施工合同" if project_name else template,
        party_a or "", party_b or "", amount or 0,
        content, address, scope,
    )
    return {"ok": True, "action": "generate_contract", "contract_id": row["id"],
            "title": f"{project_name}施工合同" if project_name else template,
            "hint": f"合同已生成（编号:{row['id']}），以下是合同全文：\n\n{content[:3000]}"}


async def _execute_review_contract(conn, tenant_id: str, message: str, user: dict, file_contexts: list[dict] | None = None) -> dict:
    """法务审核合同"""
    from services.contract_service import review_contract

    # 收集合同文本
    contract_text = ""
    
    if file_contexts:
        for fc in file_contexts:
            if fc.get("context_text") and len(fc["context_text"]) > 50:
                contract_text += fc["context_text"] + "\n"
    
    if not contract_text:
        rows = await conn.fetch(
            "SELECT id, title, content FROM biz_contracts WHERE tenant_id=$1 AND content != '' ORDER BY created_at DESC LIMIT 3",
            tenant_id,
        )
        if rows:
            contract_text = rows[0]["content"]

    if not contract_text and len(message) > 50:
        contract_text = message

    if not contract_text or len(contract_text) < 30:
        return {"ok": False, "hint": "请提供需要审核的合同文本。可以上传合同文件，或者说「审核刚才生成的合同」。"}

    review = await review_contract(contract_text)
    if not review:
        return {"ok": False, "hint": "合同审核暂时不可用，请稍后再试"}

    return {"ok": True, "action": "review_contract", "hint": review}


async def _execute_calc_material(conn, tenant_id: str, message: str, user: dict) -> dict:
    """材料用量计算"""
    from services.material_calc import calculate_material, format_material_result

    # 提取面积
    area_match = re.search(r'(\d{2,5})\s*(?:平方|平米|m2|㎡|平方米|平)', message)
    area = float(area_match.group(1)) if area_match else None
    if not area:
        return {"ok": False, "hint": "请告诉我施工面积是多少平方米"}

    # 提取厚度
    thickness_match = re.search(r'(\d{1,2})\s*(?:公[分]?|厘[米]?|cm|毫米|mm)', message)
    thickness = None
    if thickness_match:
        thickness = thickness_match.group(1)
        try:
            thickness = float(thickness)
            if any(w in message for w in ["毫米", "mm"]):
                thickness = thickness / 10  # mm → cm
        except ValueError:
            thickness = 5  # 默认5cm

    if not thickness:
        thickness = 5  # 默认厚度

    # 提取材料类型
    formula_name = "半干砂浆"  # 默认
    for k in ["抗裂砂浆", "半干砂浆", "自流平", "混凝土", "无机磨石", "磨石基层"]:
        if k in message:
            formula_name = k
            break

    result = calculate_material(formula_name, area, thickness)
    if not result:
        # 列出可用类型
        types = "抗裂砂浆、半干砂浆、自流平砂浆、混凝土C25、无机磨石基层、砌筑砂浆、抹灰砂浆、保温砂浆"
        return {"ok": False, "hint": f"未识别材料类型。支持：{types}。请说清楚用哪种。"}

    text = format_material_result(result)
    return {"ok": True, "action": "calc_material", "hint": text}


# ============================================================
# 导入功能引导执行器（无需DB，引导用户使用导入页面）
# ============================================================

async def _execute_import_sms(conn, tenant_id: str, message: str, user: dict) -> dict:
    """引导用户使用短信导入功能"""
    return {
        "ok": True,
        "action": "import_sms",
        "guide": True,
        "hint": (
            "📱 短信导入方法：\n"
            "1️⃣ 打开APP侧边菜单 → 点击「数据导入」\n"
            "2️⃣ 点击「短信导入」→ 授权读取短信权限\n"
            "3️⃣ 系统自动读取短信并提取联系人\n\n"
            "💡 也可以直接对我说「我要导入短信」"
        ),
    }

async def _execute_import_wechat(conn, tenant_id: str, message: str, user: dict) -> dict:
    """引导用户使用微信聊天记录导入功能"""
    return {
        "ok": True,
        "action": "import_wechat",
        "guide": True,
        "hint": (
            "📱 微信聊天记录导入方法：\n"
            "1️⃣ 打开APP侧边菜单 → 点击「数据导入」\n"
            "2️⃣ 点击「微信聊天记录」→ 选择导入方式\n"
            "3️⃣ 方式A：从微信直接分享聊天记录到灵境APP\n"
            "4️⃣ 方式B：在微信电脑端导出聊天记录文件（TXT格式），然后上传\n\n"
            "💡 推荐方式A：在微信中打开聊天 → 点击右上角··· → "
            "更多 → 导出聊天记录 → 选择灵境"
        ),
    }

async def _execute_import_contacts(conn, tenant_id: str, message: str, user: dict) -> dict:
    """引导用户使用通讯录导入功能"""
    return {
        "ok": True,
        "action": "import_contacts",
        "guide": True,
        "hint": (
            "📱 通讯录导入方法：\n"
            "1️⃣ 打开APP侧边菜单 → 点击「数据导入」\n"
            "2️⃣ 点击「通讯录导入」→ 授权读取通讯录权限\n"
            "3️⃣ 系统自动读取通讯录并匹配为线索\n\n"
            "💡 也可以直接对我说「导入通讯录」"
        ),
    }


async def _execute_query_import_data(conn, tenant_id: str, message: str, user: dict) -> dict:
    """查询已导入的数据记录"""
    if not tenant_id:
        return {"ok": False, "hint": "请先加入企业后再查看导入记录"}

    try:
        # 判断用户想查哪种类型的导入
        if re.search(r'短信|SMS', message):
            source_filter = "sms"
            label = "短信"
        elif re.search(r'通讯录|联系人', message):
            source_filter = "contacts"
            label = "通讯录"
        elif re.search(r'微信', message):
            source_filter = "wechat"
            label = "微信"
        else:
            source_filter = None
            label = "数据"

        if source_filter:
            rows = await conn.fetch(
                """SELECT id, source_type, total_items, imported_items, skipped_items,
                          status, stats, created_at
                   FROM import_records
                   WHERE tenant_id=$1 AND source_type=$2
                   ORDER BY created_at DESC LIMIT 5""",
                tenant_id, source_filter,
            )
        else:
            rows = await conn.fetch(
                """SELECT id, source_type, total_items, imported_items, skipped_items,
                          status, stats, created_at
                   FROM import_records
                   WHERE tenant_id=$1
                   ORDER BY created_at DESC LIMIT 5""",
                tenant_id,
            )

        if not rows:
            return {
                "ok": True,
                "action": "query_import_data",
                "query": True,
                "hint": f"暂无{label}导入记录。可以对我说「导入{label}」来导入数据。",
            }

        parts = [f"📋 以下是最新的{label}导入记录："]
        src_names = {"sms": "📱短信", "wechat": "💬微信", "contacts": "👤通讯录"}
        for r in rows:
            src = src_names.get(r["source_type"], r["source_type"])
            time = r["created_at"].strftime("%m-%d %H:%M") if r["created_at"] else ""
            status = "✅" if r["status"] == "completed" else "❌"
            items = r["total_items"] or 0
            imported = r["imported_items"] or 0
            parts.append(f"  {status} {src} {time} — 共{items}项，导入{imported}项")

        parts.append("\n💡 想导入更多数据？对我说「导入短信/微信/通讯录」")
        return {"ok": True, "action": "query_import_data", "query": True, "hint": "\n".join(parts)}

    except Exception as e:
        logger.error(f"查询导入记录失败: {e}")
        return {"ok": False, "hint": "查询导入记录失败，请稍后再试"}


# 动作ID → 执行函数的映射
_EXECUTORS = {
    "add_customer": _execute_add_customer,
    "add_invoice": _execute_add_invoice,
    "add_supplier": _execute_add_supplier,
    "submit_expense": _execute_submit_expense,
    "fund_request": _execute_fund_request,
    "create_project": _execute_create_project,
    "update_progress": _execute_update_progress,
    "advance_customer": _execute_advance_customer,
    "bind_project": _execute_bind_project,
    "unbind_project": _execute_unbind_project,
    "self_checkin": _execute_self_checkin,
    "reset_member_password": _execute_reset_member_password,
    "change_own_password": _execute_change_own_password,
    "approve_finance": _execute_approve_finance,
    "reject_finance": _execute_reject_finance,
    "complete_todo": _execute_complete_todo,
    "query_import_data": _execute_query_import_data,
}


def format_action_result(result: dict) -> str:
    """将动作结果格式化为AI可读文本"""
    if not result.get("ok"):
        if result.get("hint"):
            return f"[灵境需要补充信息] {result['hint']}"
        return ""

    action = result.get("action", "")
    if action == "add_invoice":
        type_zh = "进项（收票）" if result.get("invoice_type") == "purchase" else "销项（开票）"
        s = f"已录入{type_zh}发票"
        if result.get("invoice_no"):
            s += f"：{result['invoice_no']}"
        if result.get("title"):
            s += f"（{result['title']}）"
        if result.get("total_amount"):
            s += f"，金额 ¥{result['total_amount']:,.2f}"
        elif result.get("amount"):
            s += f"，金额 ¥{result['amount']:,.2f}"
        if result.get("customer_name"):
            s += f"，客户：{result['customer_name']}"
        if result.get("supplier_name"):
            s += f"，供应商：{result['supplier_name']}"
        if result.get("category"):
            s += f"，类别：{result['category']}"
        s += f"（编号:{result.get('invoice_id', '')}）"
        return f"[灵境已执行] {s}"

    if action == "add_customer":
        parts = [f"已录入新客户：{result['customer_name']}"]
        if result.get("contact_person"):
            parts.append(f"，联系人 {result['contact_person']}")
        if result.get("phone"):
            parts.append(f"，电话 {result['phone']}")
        if result.get("company"):
            parts.append(f"，公司 {result['company']}")
        parts.append(f"（编号:{result['id']}，状态:待跟进）")
        return "[灵境已执行] " + "".join(parts)

    if action == "add_supplier":
        cat = f"（{result['material_type']}供应商）" if result.get("material_type") else ""
        parts = [f"已录入供应商：{result['supplier_name']}{cat}"]
        if result.get("contact_person"):
            parts.append(f"，联系人 {result['contact_person']}")
        if result.get("phone"):
            parts.append(f"，电话 {result['phone']}")
        if result.get("address"):
            parts.append(f"，地址 {result['address']}")
        parts.append(f"（编号:{result['id']}）")
        return "[灵境已执行] " + "".join(parts)

    if action == "submit_expense":
        cat_zh = {"原料采购": "原料采购", "零星采购": "零星采购", "临时工零星支付": "临时工零星支付"}
        cat_display = cat_zh.get(result.get('category',''), result.get('category',''))
        s = f"已记录采购 ¥{result['amount']:,.0f}（{cat_display}）"
        if result.get("project"):
            s += f"，项目：{result['project']}"
        if result.get("supplier"):
            s += f"，供应商：{result['supplier']}"
        if result.get("file_ids"):
            s += f"，已关联 {len(result['file_ids'])} 张单据图片"
        if result.get("deduction"):
            d = result["deduction"]
            s += f"。项目合同额 ¥{d['contract_amount']:,.0f}，已支出 ¥{d['actual_cost']:,.0f}"
            if d["alert"]:
                s += " ⚠️ 已超预算！"
            else:
                s += f"，剩余 ¥{d['remaining']:,.0f}"
        return f"[灵境已执行] {s}"

    if action == "fund_request":
        s = f"已提交备用金申请 ¥{result['amount']:,.0f}"
        if result.get("project"):
            s += f"，项目：{result['project']}"
        if result.get("deduction"):
            d = result["deduction"]
            s += f"。合同额 ¥{d['contract_amount']:,.0f}，已支出 ¥{d['actual_cost']:,.0f}，剩余 ¥{d['remaining']:,.0f}"
        return f"[灵境已执行] {s}，状态：待审批"

    if action == "create_project":
        s = f"已创建新项目：{result['project_name']}"
        if result.get("contract_amount"):
            s += f"，合同额 ¥{result['contract_amount']:,.0f}"
        if result.get("location"):
            s += f"，地点：{result['location']}"
        return f"[灵境已执行] {s}"

    if action == "update_progress":
        s = f"项目 {result['project']} 进度已更新为 {result['progress']}%"
        if result.get("status") == "completed":
            s += "（已完工）"
        return f"[灵境已执行] {s}"

    if action == "advance_customer":
        return (f"[灵境已执行] 客户 {result['customer_name']} "
                f"阶段已更新：{result['old_stage']} → {result['new_stage']}")

    if action == "assign_role":
        s = f"已将 {result['member_name']} 的角色设定为「{result['role']}」"
        if result.get("worker_type"):
            s += f"，工种：{result['worker_type']}"
        if result.get("daily_wage"):
            s += f"，日薪：{result['daily_wage']}元/天"
        return f"[灵境已执行] {s}"

    if action == "bind_project":
        return f"[灵境已执行] 已将 {result['member_name']}（{result['role']}）安排到项目「{result['project_name']}」"

    if action == "unbind_project":
        return f"[灵境已执行] 已将 {result['member_name']} 从项目「{result['project_name']}」调离"

    if action == "self_checkin":
        return f"[灵境已执行] {result['user_name']} {result['check_type']}打卡成功，项目：{result['project_name']}，时间：{result['time']}"

    if action == "reset_member_password":
        return f"[灵境已执行] 已将 {result['member_name']} 的密码重置为新密码。请通知该成员使用新密码登录"

    if action == "rename_member":
        return f"[灵境已执行] 已将 {result['member_name']} 更名为「{result['new_name']}」"

    if action == "change_own_password":
        return ("[灵境已执行] 密码已修改成功，下次登录请使用新密码。"
                "当前会话不受影响，如需立即使用新密码请退出重新登录")

    if action == "add_recipe":
        s = f"已录入新配方：{result['recipe_name']}"
        if result.get("description"):
            s += f"（{result['description'][:20]}...）"
        if result.get("category"):
            s += "，分类：" + result['category'] + "）"
        return f"[灵境已执行] {s}（编号:{result['id']}）"

    if action == "add_template_image":
        if result.get("guide"):
            return f"[灵境引导] {result['hint']}"
        parts = [f"已保存样板：{result.get('template_name', result.get('sample_id', ''))}"]
        if result.get("auto_name"):
            parts.append(f"\n  自动命名：{result['auto_name']}（后期可修改）")
        if result.get("project_name"):
            parts.append(f"\n  项目：{result['project_name']}")
        if result.get("recipe_name"):
            parts.append(f"\n  配方：{result['recipe_name']}")
        if result.get("has_photo") is False:
            parts.append("\n  ⚠️ 未上传照片，可稍后补传")
        if result.get("hint"):
            parts.append(f"\n  {result['hint']}")
        return "[灵境已执行] " + "".join(parts)

    if action == "send_to_factory":
        return f"[灵境已执行] {result.get('hint', '样品已发送工厂')}"

    if action == "generate_contract":
        return f"[灵境已执行] {result.get('hint', '合同已生成')}"

    if action == "review_contract":
        return f"[灵境审核结果]\n\n{result.get('hint', '审核完成')}"

    if action == "calc_material":
        return result.get("hint", "计算完成")

    if action == "update_sample":
        return f"[灵境已执行] 样板 #{result.get('sample_id', '')} 信息已更新：{result.get('hint', '')}"

    if action == "approve_finance":
        return f"[灵境已执行] 已通过 {result['applicant']} 的申请，金额¥{result['amount']:,.0f}"

    if action == "reject_finance":
        return f"[灵境已执行] 已驳回 {result['applicant']} 的申请（金额¥{result['amount']:,.0f}）"

    if action == "complete_todo":
        return f"[灵境已执行] 待办「{result['title']}」已标记完成"

    if action == "web_search":
        report = result.get("report", "")
        return f"[灵境搜索报告]\n\n{report}"

    if action == "analyze_wechat":
        hint = result.get("hint", "")
        return f"[灵境微信分析]\n\n{hint}"

    if result.get("guide"):
        hint = result.get("hint", "")
        return f"[灵境导入指引]\n\n{hint}"

    if result.get("query"):
        hint = result.get("hint", "")
        return f"[灵境查询结果]\n\n{hint}"

    return ""


# ============================================================
# 新增：配方和样板图片执行器
# ============================================================

async def _execute_add_recipe(conn, tenant_id: str, message: str, user: dict) -> dict:
    """录入新配方（支持追加模式）"""
    name = _extract_name(message, ["配方叫", "配方", "叫", "是"])
    if not name:
        return {"ok": False, "need": "配方名称", "hint": "请告诉我配方叫什么名字"}

    # 检查是否已存在同名配方 → 追加模式
    existing = await conn.fetchrow(
        "SELECT id, ingredients FROM recipes WHERE tenant_id=$1 AND name=$2 AND status='active'",
        tenant_id, name,
    )

    # 提取描述
    description = None
    desc_match = re.search(r"(?:描述|说明|内容|做法)[：:\s]*(.+?)(?:[，。、；]|$)", message)
    if desc_match:
        description = desc_match.group(1).strip()

    # 提取分类
    category = None
    cat_match = re.search(r"(?:分类|类别|属于|是)[：:\s]*(.+?)(?:[，。、；]|$)", message)
    if cat_match:
        category = cat_match.group(1).strip()

    # 提取步骤
    steps = []
    step_match = re.search(r"(?:步骤|工序|流程)[：:\s]*(.+?)(?:[，。、；]|$)", message)
    if step_match:
        raw_steps = step_match.group(1).split("；")
        for s in raw_steps:
            s = s.strip()
            if s:
                steps.append({"step": len(steps)+1, "content": s})

    # 提取原料 — 增强解析：支持比例(1:2)、百分比(3%)、单位(kg/g/ml)
    ingredients = []
    ing_match = re.search(r"(?:原料|材料|配料|成分)[：:\s]*(.+?)(?:[，。、；]步骤|工序|流程|分类|$)", message)
    if not ing_match:
        # 退避：直接匹配 "A:B=1:2" 或 "A 30kg" 模式
        ing_match = re.search(
            r'([\u4e00-\u9fffA-Za-z]+?\s*[:=：=]\s*\d+\s*[：:]\s*[\u4e00-\u9fffA-Za-z]+)'
            r'|(\d+kg\s*[\u4e00-\u9fff]+)',
            message
        )

    if ing_match:
        raw_text = ing_match.group(0) if ing_match.lastindex is None else ing_match.group(0)
        # 分割：按中文顿号、逗号、分号；英文分号
        raw_ings = re.split(r'[；;，,、]', raw_text)
        for item in raw_ings:
            item = item.strip()
            if not item:
                continue

            # 解析 "材料名 数量单位" 或 "材料名:数量" 或 "材料名=比例"
            qty = ""
            ratio = ""
            ing_name = item

            # "A:B=2:1" 比例模式
            ratio_m = re.match(r'(.+?)[：:=](.+?[:：]\d+)', item)
            if ratio_m:
                ing_name = ratio_m.group(1).strip()
                ratio = ratio_m.group(2).strip()
            else:
                # "A 30kg" / "A 5%" / "A 3份"
                qty_m = re.match(r'(.+?)\s+(\d+(?:\.\d+)?\s*(?:kg|g|ml|L|份|%|公斤|克|毫升|升))', item)
                if qty_m:
                    ing_name = qty_m.group(1).strip()
                    qty = qty_m.group(2).strip()

            if ing_name:
                ingredients.append({
                    "name": ing_name[:50],
                    "quantity": qty,
                    "ratio": ratio,
                })

    if existing:
        # 追加模式：合并原料
        old_ings = json.loads(existing['ingredients']) if isinstance(existing['ingredients'], str) else (existing['ingredients'] or [])
        existing_names = {i.get('name', '') for i in old_ings}
        for ing in ingredients:
            if ing['name'] not in existing_names:
                old_ings.append(ing)
        ingredients = old_ings

        await conn.execute(
            """UPDATE recipes SET
               ingredients=$1, description=COALESCE($2, description),
               category=COALESCE($3, category), updated_at=NOW()
               WHERE id=$4""",
            json.dumps(ingredients, ensure_ascii=False),
            description, category, existing['id'],
        )
        result = {
            "ok": True,
            "action": "add_recipe",
            "recipe_name": name,
            "id": existing['id'],
            "mode": "append",
        }
    else:
        # 新建模式
        row = await conn.fetchrow(
            """INSERT INTO recipes (tenant_id, name, description, ingredients, steps, category, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id""",
            tenant_id, name, description or "",
            json.dumps(ingredients, ensure_ascii=False),
            json.dumps(steps, ensure_ascii=False),
            category or "",
            user.get("user_id") or 0,
        )
        result = {
            "ok": True,
            "action": "add_recipe",
            "recipe_name": name,
            "id": row["id"],
            "mode": "create",
        }
    if description:
        result["description"] = description
    if category:
        result["category"] = category
    return result


async def _execute_add_template_image(conn, tenant_id: str, message: str, user: dict, file_contexts: list[dict] | None = None) -> dict:
    """录入样板 — 一步保存：照片+配方。如果当前消息无照片，从最近会话消息中查找。

    触发词：录样板/打个样/录个XX号样板/就录成这个
    """
    user_code = user.get("code") or user.get("user_id", "")

    # ══ 第一步：快速判断是否为纯查询意图（不走任何DB操作） ══
    if (re.search(r'(?:调出|查看|查询|查一下|看看|有哪些|找|给我看|给我看看).*(?:样板|样图|样品)', message) 
        or re.search(r'(?:样板|样图|样品).*(?:记录|历史|查询|列表|有哪些|查一下|调出|看看|在哪)', message)):
        return {"ok": False, "msg": "查询意图"}

    # ══ 第二步：收集图片 file_ids ══
    file_ids = []
    image_url = None
    if file_contexts:
        for fc in file_contexts:
            if fc.get('type') == 'image':
                file_ids.append(fc['file_id'])
                image_url = image_url or fc.get('url', '')

    # 当前消息无图片 → 从最近会话消息中找
    if not file_ids:
        session_id = user.get("_session_id")
        if session_id:
            try:
                recent = await conn.fetch(
                    """SELECT attachments FROM chat_messages
                       WHERE session_id = $1 AND role = 'user' AND attachments IS NOT NULL
                       ORDER BY created_at DESC LIMIT 3""",
                    session_id,
                )
                for r in recent:
                    atts = json.loads(r["attachments"]) if isinstance(r["attachments"], str) else (r["attachments"] or [])
                    for a in atts:
                        if a.get("type") == "image" and a.get("file_id"):
                            if a["file_id"] not in file_ids:
                                file_ids.append(a["file_id"])
                                if not image_url: image_url = a.get("url", "")
            except Exception as e:
                logger.warning(f"样板图片解析失败: {e}")

    # 照片改为选填：无照片也能创建样板，后续可补传
    has_photo = len(file_ids) > 0
    if not has_photo:
        logger.info(f"样板录入无照片，将创建无图样板（用户 {user_code}）")

    # ── 提取配方信息（当前消息 + 最近AI回复） ──
    from services.sample_service import FORMULA_TEMPLATES
    recipe_name = ""
    formula = {}

    # 合并消息 + 最近AI回复来提取配方名
    search_text = message
    try:
        session_id = user.get("_session_id")
        if session_id:
            recent_ai = await conn.fetch(
                "SELECT content FROM chat_messages WHERE session_id=$1 AND role='assistant' ORDER BY created_at DESC LIMIT 2",
                session_id,
            )
            for r in recent_ai:
                search_text += " " + (r["content"] or "")[:500]
    except Exception as e:
        logger.warning(f"配方匹配历史搜索失败: {e}")

    # 匹配模板
    for k, v in FORMULA_TEMPLATES.items():
        if k in search_text:
            recipe_name = k
            formula = v
            break

    if not recipe_name:
        m = re.search(r'([\u4e00-\u9fffA-Za-z0-9_-]{2,20})(?:配方|面层|磨石|配比)', search_text)
        if m:
            recipe_name = m.group(1).strip()

    # 提取配比
    if not formula:
        raw_formula = _extract_formula_parts(search_text)
        if raw_formula:
            formula = raw_formula

    # 提取客户名
    customer = _extract_name(message, ["客户", "给", "是", "叫"])
    if not customer:
        # "李总的样板" → 提取李总
        m = re.search(r'([\u4e00-\u9fff]{1,4})(?:总的?|老板|经理)', message)
        if m: customer = m.group(1)

    # ── 自动命名：当没有客户名时，用日期+色系生成名称 ──
    sample_auto_name = ""
    if not customer:
        from datetime import date as _date
        color_keywords = {
            "黑": ["黑", "墨", "碳黑", "铁黑"],
            "白": ["白", "乳白", "纯白", "象牙白"],
            "灰": ["灰", "银灰", "中灰", "深灰", "浅灰", "水泥"],
            "红": ["红", "朱红", "铁红", "砖红"],
            "蓝": ["蓝", "钴蓝", "群青"],
            "绿": ["绿", "铬绿", "翠绿"],
            "黄": ["黄", "铁黄", "土黄", "金黄"],
            "棕": ["棕", "褐", "咖啡", "巧克力"],
            "彩": ["彩", "彩色", "混色", "花"],
        }
        color_found = ""
        search_lower = (message + search_text).lower()
        for cn_name, patterns in color_keywords.items():
            for p in patterns:
                if p in search_lower or p in (message + search_text):
                    color_found = cn_name
                    break
            if color_found:
                break
        if not color_found and formula:
            # 从配比中推测色系：含颜料→看颜色关键词
            for key in formula:
                if any(c in key for c in ["黑","白","红","蓝","绿","黄","灰","棕","彩","颜料","色浆","色"]):
                    for cn, ps in color_keywords.items():
                        if any(p in key for p in ps):
                            color_found = cn
                            break
                    if color_found:
                        break
        today_str = _date.today().strftime('%Y%m%d')
        sample_auto_name = f"{today_str}" + (f"-{color_found}" if color_found else "")
        customer = sample_auto_name

    # ── 关联项目 ──
    project_match = re.search(
        r'(?:项目|工地|工程)[：:\s]*([一-鿿A-Za-z0-9（）()]{2,20})'
        r'|([一-鿿A-Za-z0-9（）()]{2,20})(?:项目|工地的?|工程的?)',
        search_text
    )
    if project_match:
        pn = (project_match.group(1) or project_match.group(2)).strip()
        row = await conn.fetchrow(
            "SELECT id, name FROM biz_projects WHERE tenant_id=$1 AND name ILIKE $2 AND status != 'closed' LIMIT 1",
            tenant_id, f'%{pn}%',
        )
        # row used as existence check below

    # 提取规格
    spec_match = re.search(r'(\d{2,4})\s*[xX×]\s*(\d{2,4})\s*[xX×]?\s*(\d{1,3})?\s*mm', message)
    specification = spec_match.group(0) if spec_match else ""

    # 提取城市
    city = ""
    m = re.search(r'([\u4e00-\u9fff]{2,4})(?:市|区|县)', message)
    if m: city = m.group(1)

    # ── 关联已有recipes ──
    recipe_id = None
    if recipe_name:
        row = await conn.fetchrow(
            "SELECT id FROM recipes WHERE tenant_id=$1 AND name ILIKE $2 AND status='active' LIMIT 1",
            tenant_id, f'%{recipe_name}%',
        )
        if row: recipe_id = row['id']

    # ── 写入 sample_records ──
    # notes 包含结构化摘要 + 用户原话，便于模糊搜索
    keyword_msg = re.sub(r'(?:录|加|新|帮我|录入|一个|个)\s*(?:样板|打样|样品)', '', message)
    summary = f"配方:{recipe_name or '自定义'}"
    if sample_auto_name: summary = f"名称:{sample_auto_name} " + summary
    if customer and customer != sample_auto_name: summary = f"客户:{customer} " + summary
    if city: summary += f" 城市:{city}"
    if specification: summary += f" 规格:{specification}"
    notes = f"{summary} | {keyword_msg.strip()}" if keyword_msg.strip() else summary

    row = await conn.fetchrow(
        """INSERT INTO sample_records
           (tenant_id, customer_name, city, specification, recipe_name,
            formula, recipe_id, image_url, image_file_id, file_ids, status, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11,$12)
           RETURNING id, created_at""",
        tenant_id, customer or "", city, specification, recipe_name,
        json.dumps(formula, ensure_ascii=False), recipe_id,
        image_url or '', file_ids[0] if file_ids else '', json.dumps(file_ids, ensure_ascii=False),
        notes[:500], user_code,
    )

    # ── 写入记忆（强关联，跨会话可查） ──
    try:
        memory_content = f"已录入{row['id']}号样板"
        if sample_auto_name:
            memory_content += f"（{sample_auto_name}）"
        elif customer:
            memory_content += f"（客户{customer}）"
        memory_content += f"，配方{recipe_name or '自定义'}"
        if formula and isinstance(formula, dict) and len(formula) > 0:
            items = [f"{k}{v['amount']}{v['unit']}" for k,v in list(formula.items())[:4]]
            memory_content += f"，配比{'、'.join(items)}"
        memory_hash = hashlib.sha256(memory_content.encode()[:200]).hexdigest()[:16]
        meta = {"auto_extracted": True, "sample_id": row["id"], "file_ids": file_ids, "formula": formula}
        await conn.execute(
            """INSERT INTO memories (memory_id, partner_id, tenant_id, content, type, source, priority, metadata, hash, source_type, confidence, scope)
               VALUES ($1,$2,$3,$4,'action',$5,90,$6,$7,'user_stated',0.9,'team')
               ON CONFLICT DO NOTHING""",
            f"sample_{row['id']}", user_code, tenant_id, memory_content[:500], "chat:manual_save",
            json.dumps(meta, ensure_ascii=False), memory_hash,
        )
    except Exception as e:
        logger.warning(f"样板手动保存记忆写入失败: {e}")

    # ── 构建返回 ──
    formula_desc = ""
    if formula and isinstance(formula, dict) and len(formula) > 0:
        items = [f"{k}{v.get('amount','')}{v.get('unit','')}" for k, v in list(formula.items())[:5]]
        formula_desc = f"\n配比：{'、'.join(items)}"

    hint = f"样板 #{row['id']} 已保存"
    if sample_auto_name:
        hint += f"\n自动命名：{sample_auto_name}（后期可修改）"
    if customer and customer != sample_auto_name:
        hint += f"\n客户：{customer}"
    if specification: hint += f"\n规格：{specification}" 
    hint += formula_desc
    if not has_photo:
        hint += "\n⚠️ 未上传照片，可稍后补传"
    hint += "\n后续可补充客户信息、收货地址，完成后说「样品发给工厂调试大样」"

    return {"ok": True, "action": "add_template_image",
            "template_name": f"{sample_auto_name or recipe_name or '自定义'}样板",
            "sample_id": row['id'],
            "customer_name": customer or "", "recipe_name": recipe_name,
            "auto_name": sample_auto_name,
            "has_photo": has_photo,
            "hint": hint}


def _extract_formula_parts(message: str) -> dict:
    """从消息中提取配方配比，如 '白水泥500g 石英砂1200g 颜料15g 减水剂5g 水180ml'"""
    parts = re.findall(r'([\u4e00-\u9fffA-Za-z]+)\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|L|份|%)', message)
    if not parts:
        return {}
    formula = {}
    for name, amount, unit in parts:
        formula[name.strip()] = {"amount": float(amount), "unit": unit}
    return formula


async def _execute_send_to_factory(conn, tenant_id: str, message: str, user: dict) -> dict:
    """发送样品给工厂"""
    from services.sample_service import send_to_factory, fuzzy_search
    
    # 查找最近的已完成样品
    user_code = user.get("code") or user.get("user_id", "")
    
    # 尝试从消息中提取样品ID或关键词
    m = re.search(r'(?:样品|样板)\s*#?(\d+)', message)
    sample_id = None
    if m:
        sample_id = int(m.group(1))
    else:
        # 模糊搜索找最近的已完成样品
        results = await fuzzy_search(tenant_id, message.replace("发工厂","").replace("发送","").replace("调试","").strip())
        for r in results:
            if r["status"] == "completed":
                sample_id = r["id"]
                break
    
    if sample_id:
        result = await send_to_factory(tenant_id, sample_id, user_code)
    else:
        return {"ok": False, "hint": "没找到已完成的样品。请先完成样品录入（录入客户/地址/规格/配方/上传照片），再说「发工厂」。\n或者直接说「发工厂 样品#编号」"}
    
    if result["ok"]:
        specs = result["specs"]
        return {"ok": True, "action": "send_to_factory", "sample_id": sample_id,
                "hint": f"样品 #{sample_id} 已发送工厂！\n客户：{specs.get('customer','')}\n地址：{specs.get('address','')}\n规格：{specs.get('specification','')}\n配方：{specs.get('recipe_name','')}\n工厂收到后将进行小批量调试生产。"}
    return {"ok": False, "hint": result.get("hint", "发送工厂失败")}


async def _execute_update_sample(conn, tenant_id: str, message: str, user: dict) -> dict:
    """更新样板信息：阶段(打样/确认中/已确认)、签约(已/未)、绑定项目
    
    支持自然语言：
      - "3号样板已确认" / "这个样板处于打样阶段"
      - "3号样板已签约" / "这个样板还没签合同"
      - "把3号样板绑到永颐项目"
    """
    from services.sample_service import fuzzy_search
    
    # 提取样板ID
    sample_id = None
    m = re.search(r'(\d+)\s*号\s*(?:样板|样品)', message)
    if m:
        sample_id = int(m.group(1))
    else:
        # 通过关键词搜索找最近的样板
        results = await fuzzy_search(tenant_id, message)
        if results:
            sample_id = results[0]["id"]
    
    if not sample_id:
        return {"ok": False, "hint": "没找到要更新的样板，请告诉我是几号样板"}
    
    # 验证样板存在
    row = await conn.fetchrow(
        "SELECT id, customer_name FROM sample_records WHERE id=$1 AND tenant_id=$2",
        sample_id, tenant_id,
    )
    if not row:
        return {"ok": False, "hint": f"样板 #{sample_id} 不存在"}
    
    updates = []
    hints = []
    
    # ── 检测阶段 ──
    if re.search(r'已确认|确认了|确认过', message):
        updates.append("phase='confirmed'")
        hints.append("阶段→已确认")
    elif re.search(r'确认中|确认阶段|待确认|还在确认', message):
        updates.append("phase='confirming'")
        hints.append("阶段→确认中")
    elif re.search(r'打样阶段|打样中|还在打样|打样', message):
        updates.append("phase='proofing'")
        hints.append("阶段→打样阶段")
    
    # ── 检测签约 ──
    if re.search(r'已签|签了|签约了?|已签约', message) and not re.search(r'没签|未签|还没签|还没签约', message):
        updates.append("is_signed=TRUE")
        hints.append("签约状态→已签约")
    elif re.search(r'没签|未签|还没签|还没签约|未签约', message):
        updates.append("is_signed=FALSE")
        hints.append("签约状态→未签约")
    
    # ── 检测绑定项目 ──
    m_proj = re.search(r'(?:绑[定到]|关联到?|绑定到?|关联到)\s*(.{2,20}?)(?:\s*项目|\s*$)', message)
    if m_proj:
        proj_name = m_proj.group(1).strip()
        proj_row = await conn.fetchrow(
            "SELECT id, name FROM biz_projects WHERE tenant_id=$1 AND name ILIKE '%' || $2 || '%'",
            tenant_id, proj_name,
        )
        if proj_row:
            updates.append(f"project_id={proj_row['id']}")
            updates.append(f"project_name='{proj_row['name'].replace(chr(39), chr(39)+chr(39))}'")
            hints.append(f"项目→{proj_row['name']}")
        else:
            # 没找到项目，仍然设置 project_name
            updates.append(f"project_name='{proj_name.replace(chr(39), chr(39)+chr(39))}'")
            hints.append(f"项目→{proj_name}")
    
    if not updates:
        return {"ok": False, "hint": "没有识别到需要更新的信息。你可以说「3号样板已确认」「3号样板已签约」「把3号样板绑到XX项目」"}
    
    updates.append("updated_at=NOW()")
    sql = f"UPDATE sample_records SET {', '.join(updates)} WHERE id=$1 AND tenant_id=$2"
    try:
        await conn.execute(sql, sample_id, tenant_id)
        return {"ok": True, "action": "update_sample", "sample_id": sample_id,
                "hint": "，".join(hints)}
    except Exception as e:
        logging.getLogger("lingjing.biz").error(f"更新样板失败: {e}")
        return {"ok": False, "hint": f"更新失败: {e}"}


# 补充 _EXECUTORS 映射（函数定义在字典之后，这里补注册）
_EXECUTORS["add_recipe"] = _execute_add_recipe
_EXECUTORS["add_template_image"] = _execute_add_template_image
_EXECUTORS["send_to_factory"] = _execute_send_to_factory
_EXECUTORS["generate_contract"] = _execute_generate_contract
_EXECUTORS["review_contract"] = _execute_review_contract
_EXECUTORS["calc_material"] = _execute_calc_material
_EXECUTORS["update_sample"] = _execute_update_sample
_EXECUTORS["rename_member"] = _execute_rename_member


async def _execute_web_search(conn, tenant_id: str, message: str, user: dict) -> dict:
    """执行网络搜索 + AI分析"""
    try:
        from services.web_search_service import search_and_analyze, competitive_analysis

        # 判断是否竞品对比意图
        is_competitive = bool(re.search(
            r'(?:竞品|竞争对手|同行|对手|对比|比较|和.{0,4}(?:区别|差别|不同|对比))',
            message
        ))

        if is_competitive:
            report = await competitive_analysis(message, tenant_id)
        else:
            report = await search_and_analyze(message, tenant_id)

        if not report:
            return {"ok": False, "hint": "未找到相关信息，请尝试更具体的搜索关键词"}

        return {
            "ok": True,
            "action": "web_search",
            "report": report,
            "is_competitive": is_competitive,
        }
    except ImportError as e:
        logger.warning(f"搜索服务导入失败: {e}")
        return {"ok": False, "hint": "搜索服务暂不可用，请稍后再试"}
    except Exception as e:
        logger.error(f"搜索执行失败: {e}")
        return {"ok": False, "hint": f"搜索暂时失败: {str(e)[:100]}"}

_EXECUTORS["web_search"] = _execute_web_search


# ============================================================
# 主入口
# ============================================================
# 业务通知接入
# ============================================================

async def _send_biz_notifications(tenant_id: str, results: list[dict], user: dict):
    """根据业务执行结果，自动触发通知推送"""
    try:
        from services.notification_service import notify

        for r in results:
            action = r.get("action", "")
            applicant_name = user.get("nickname", "") or user.get("name", "")
            applicant_id = user.get("user_id", "") or user.get("code", "")

            if action == "submit_expense":
                await notify(
                    tenant_id=tenant_id,
                    event_type="expense_submitted",
                    title=f"💰 {applicant_name} 提交了一笔报销",
                    body=f"金额: ¥{r.get('amount', 0):,.0f}，类别: {r.get('category', 'other')}",
                    ref_type="finance",
                    ref_id=str(r.get("id", "")),
                    extras={"applicant_id": applicant_id, "amount": r.get("amount", 0),
                            "category": r.get("category", ""),
                            "project": r.get("project", "")},
                )

            elif action == "fund_request":
                await notify(
                    tenant_id=tenant_id,
                    event_type="fund_requested",
                    title=f"🏦 {applicant_name} 申请备用金",
                    body=f"金额: ¥{r.get('amount', 0):,.0f}",
                    ref_type="finance",
                    ref_id=str(r.get("id", "")),
                    extras={"applicant_id": applicant_id, "amount": r.get("amount", 0),
                            "project": r.get("project", "")},
                )

            elif action == "create_project":
                await notify(
                    tenant_id=tenant_id,
                    event_type="project_created",
                    title=f"🏗️ 新项目「{r.get('project_name', '')}」已创建",
                    body=f"负责人: {applicant_name}",
                    ref_type="project",
                    ref_id=str(r.get("id", "")),
                    extras={"project_name": r.get("project_name", ""),
                            "contract_amount": r.get("contract_amount", 0)},
                )

            elif action == "update_progress":
                await notify(
                    tenant_id=tenant_id,
                    event_type="project_updated",
                    title=f"📊 项目「{r.get('project', '')}」进度更新",
                    body=f"进度: {r.get('progress', 0)}%",
                    ref_type="project",
                    ref_id=str(r.get("id", "")),
                    extras={"project": r.get("project", ""), "progress": r.get("progress", 0)},
                )

            elif action == "record_workers":
                await notify(
                    tenant_id=tenant_id,
                    event_type="project_updated",
                    title=f"👷 {applicant_name} 记录了工人到场",
                    body=f"工人数: {r.get('workers', 0)}",
                    ref_type="attendance",
                    ref_id=str(r.get("id", "")),
                )

            elif action == "approve_finance":
                await notify(
                    tenant_id=tenant_id,
                    event_type="approval_approved",
                    title="✅ 审批已通过",
                    body=f"{r.get('applicant', '')} 的申请 ¥{r.get('amount', 0):,.0f} 已批准",
                    ref_type="finance",
                    ref_id=str(r.get("finance_id", "")),
                    extras={"applicant": r.get("applicant", ""), "amount": r.get("amount", 0)},
                )

            elif action == "reject_finance":
                await notify(
                    tenant_id=tenant_id,
                    event_type="approval_rejected",
                    title="❌ 审批已驳回",
                    body=f"{r.get('applicant', '')} 的申请 ¥{r.get('amount', 0):,.0f} 被驳回",
                    ref_type="finance",
                    ref_id=str(r.get("finance_id", "")),
                    extras={"applicant": r.get("applicant", ""), "amount": r.get("amount", 0)},
                )

            elif action == "assign_role":
                await notify(
                    tenant_id=tenant_id,
                    event_type="role_changed",
                    title="👤 成员角色变更",
                    body=f"{r.get('member', '')} 被设为 {r.get('role', '')}",
                    ref_type="user",
                    ref_id="",
                )

            elif action == "bind_project":
                await notify(
                    tenant_id=tenant_id,
                    event_type="member_added",
                    title="🔗 成员绑定项目",
                    body=f"{r.get('member', '')} 加入「{r.get('project', '')}」",
                    ref_type="project",
                    ref_id=str(r.get("project_id", "")),
                )

    except Exception as e:
        logging.getLogger("lingjing.biz").warning(f"业务通知发送失败: {e}")

# ============================================================

async def execute_business_actions(
    message: str,
    tenant_id: str | None,
    user: dict,
    file_contexts: list[dict] | None = None,
) -> str | None:
    """
    检测并执行业务动作。返回格式化的执行结果文本（注入AI上下文），
    或 None（无动作意图）。
    """
    intents = detect_action_intent(message)
    if not intents:
        return None

    # web_search 不需要租户，个人用户可用
    no_tenant_actions = {"web_search", "change_own_password"}
    if not tenant_id:
        intents = [i for i in intents if i in no_tenant_actions]
        if not intents:
            return None

    # 去重：如果同时检测到重置成员密码和修改自己密码，根据上下文选择
    if "reset_member_password" in intents and "change_own_password" in intents:
        # 有明确自指 → 修改自己密码
        if re.search(r"(?:我|自己|本人)", message):
            intents.remove("reset_member_password")
        # 有 "把/将/给/帮 + 名字(中文/英文) + 的密码" 模式 → 管理员操作
        elif re.search(r"(?:把|将|给|帮)\s*(?:[\u4e00-\u9fff]{2,4}|[a-zA-Z0-9_]{2,20})\s*(?:的)?\s*(?:密码|登录)", message):
            intents.remove("change_own_password")
        else:
            # 默认保留 change_own_password (更安全)
            intents.remove("reset_member_password")

    results = []
    notification_calls = []

    # 分离需要DB和不需要DB的动作
    no_db_actions = {"web_search", "change_own_password"}
    db_intents = [i for i in intents if i not in no_db_actions]
    no_db_intents = [i for i in intents if i in no_db_actions]

    # 执行不需要DB的动作
    for intent in no_db_intents:
        deny = _check_permission(user, intent)
        if deny:
            results.append(f"[灵境权限提示] {deny}")
            continue
        executor = _EXECUTORS.get(intent)
        if executor:
            result = await executor(None, tenant_id, message, user)
            formatted = format_action_result(result)
            if formatted:
                results.append(formatted)

    # 执行需要DB的动作
    if db_intents:
        async with database.pool.acquire() as conn:
            for intent in db_intents:
                deny = _check_permission(user, intent)
                if deny:
                    results.append(f"[灵境权限提示] {deny}")
                    continue
                executor = _EXECUTORS.get(intent)
                if executor:
                    if intent in ("add_template_image", "submit_expense", "add_invoice"):
                        result = await executor(conn, tenant_id, message, user, file_contexts)
                    else:
                        result = await executor(conn, tenant_id, message, user)
                    formatted = format_action_result(result)
                    if formatted:
                        results.append(formatted)
                    if result.get("ok"):
                        notification_calls.append(result)

        if notification_calls:
            await _send_biz_notifications(tenant_id, notification_calls, user)

    return "\n".join(results) if results else None

# ============================================================
# 微信群聊分析执行器
# ============================================================

async def _execute_analyze_wechat(conn, tenant_id: str, message: str, user: dict) -> dict:
    """分析已导入的微信群聊消息（归类/摘要/项目关联提议）"""
    try:
        # 查已有群聊
        groups = await conn.fetch(
            "SELECT group_id, name, total_messages FROM wechat_groups WHERE tenant_id=$1 AND is_active=TRUE ORDER BY total_messages DESC LIMIT 5",
            tenant_id,
        )
        if not groups:
            return {
                "ok": True, "action": "analyze_wechat",
                "hint": "目前还没有导入微信群聊记录。您可以在微信中导出聊天记录（TXT格式），然后在侧边栏「数据导入」中上传。"
            }

        result_lines = [f"📊 您共有 {len(groups)} 个群聊："]
        for g in groups:
            name = g["name"]
            total = g["total_messages"]
            result_lines.append(f"  • {name}（{total}条消息）")

        result_lines.append("\n💡 我可以帮您：")
        result_lines.append("  1️⃣ 打开APP → 微信消息 → 查看各群聊消息归类")
        result_lines.append("  2️⃣ 对指定群聊进行AI分析：点击「AI分析」按钮")
        result_lines.append("  3️⃣ 关联消息到项目：在消息详情中操作")

        # 检查是否有分析结果
        has_analysis = await conn.fetchval(
            "SELECT COUNT(*) FROM wechat_analysis WHERE tenant_id=$1 AND status='completed'",
            tenant_id,
        )
        if has_analysis and int(has_analysis) > 0:
            result_lines.append(f"\n✅ 已有 {has_analysis} 次AI分析结果，可前往查看")

        return {
            "ok": True, "action": "analyze_wechat",
            "hint": "\n".join(result_lines),
            "groups_count": len(groups),
        }
    except Exception as e:
        logger.warning(f"微信群聊分析失败: {e}")
        return {
            "ok": True, "action": "analyze_wechat",
            "hint": "微信群聊分析功能已就绪。您可以在侧边栏「微信消息」中导入群聊记录并查看AI分析结果。",
        }


# 注册 analyze_wechat 到执行器
_EXECUTORS["analyze_wechat"] = _execute_analyze_wechat
