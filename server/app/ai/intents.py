"""灵境AI - 意图定义"""
from enum import Enum

class Intent(Enum):
    """意图枚举"""
    # 管理意图
    CREATE = "create"           # 创建
    READ = "read"              # 查询
    UPDATE = "update"          # 修改
    DELETE = "delete"          # 删除

    # 审批意图
    APPROVE = "approve"        # 批准
    REJECT = "reject"          # 驳回
    SUBMIT = "submit"          # 提交申请

    # 考勤意图
    CHECK_IN = "check_in"      # 上班打卡
    CHECK_OUT = "check_out"     # 下班打卡

    # 任务意图
    ASSIGN = "assign"          # 指派任务
    COMPLETE = "complete"      # 完成
    REPORT = "report"          # 汇报

    # 搜索统计
    SEARCH = "search"          # 搜索
    STATS = "stats"            # 统计
    HELP = "help"              # 帮助

    # 未知
    UNKNOWN = "unknown"

class TargetType(Enum):
    """目标类型"""
    USER = "user"
    PROJECT = "project"
    TASK = "task"
    ATTENDANCE = "attendance"
    APPROVAL = "approval"
    WAGE = "wage"
    ANY = "any"
