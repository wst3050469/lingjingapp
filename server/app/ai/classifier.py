"""灵境AI - 意图分类器"""
from .intents import Intent, TargetType
from typing import Tuple

class IntentClassifier:
    """意图分类器"""

    # 意图关键词映射
    INTENT_PATTERNS = {
        Intent.CREATE: ["添加", "创建", "新建", "增加", "招募", "聘用", "开通"],
        Intent.READ: ["查看", "查询", "看看", "了解", "想知道", "有没有", "多少", "怎么"],
        Intent.UPDATE: ["修改", "更新", "调整", "变更", "改一下", "换"],
        Intent.DELETE: ["删除", "移除", "取消", "不要了", "删掉"],
        Intent.APPROVE: ["批准", "通过", "同意", "确认", "好的", "可以", "行"],
        Intent.REJECT: ["驳回", "拒绝", "不同意", "不行"],
        Intent.SUBMIT: ["提交", "申请", "上报"],
        Intent.CHECK_IN: ["打卡", "签到", "到岗", "上班", "我到了", "开始工作"],
        Intent.CHECK_OUT: ["下班", "签退", "走了", "结束工作"],
        Intent.ASSIGN: ["安排", "指派", "交给", "负责", "让谁"],
        Intent.COMPLETE: ["完成", "搞定了", "做好了", "结束了"],
        Intent.REPORT: ["汇报", "报告", "说下", "讲讲", "总结"],
        Intent.SEARCH: ["搜索", "找", "查一下"],
        Intent.STATS: ["统计", "汇总", "一共", "合计", "报表"],
        Intent.HELP: ["帮助", "怎么用", "有什么功能", "说明"],
    }

    # 目标类型关键词
    TARGET_PATTERNS = {
        TargetType.USER: ["用户", "员工", "工人", "经理", "管理员", "人"],
        TargetType.PROJECT: ["项目", "工地", "工程", "活"],
        TargetType.TASK: ["任务", "工作", "活儿", "事情"],
        TargetType.ATTENDANCE: ["打卡", "考勤", "签到"],
        TargetType.APPROVAL: ["申请", "审批", "报销", "费用"],
        TargetType.WAGE: ["工资", "薪水", "钱", "报酬"],
    }

    def classify(self, text: str) -> Tuple[Intent, TargetType]:
        """
        分类用户意图
        返回: (意图, 目标类型)
        """
        text = text.lower().strip()

        # 意图分类
        intent = self._classify_intent(text)

        # 目标类型分类
        target_type = self._classify_target(text)

        return intent, target_type

    def _classify_intent(self, text: str) -> Intent:
        """分类意图"""
        for intent, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if pattern in text:
                    return intent
        return Intent.READ  # 默认按查询处理

    def _classify_target(self, text: str) -> TargetType:
        """分类目标类型"""
        for target, patterns in self.TARGET_PATTERNS.items():
            for pattern in patterns:
                if pattern in text:
                    return target
        return TargetType.ANY
