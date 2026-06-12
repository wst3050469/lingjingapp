"""灵境 - 企业管理数据模型"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# ========== 租户 ==========
class Tenant(BaseModel):
    id: str = str(uuid.uuid4())
    name: str
    code: str
    logo_url: Optional[str] = None
    config: Dict[str, Any] = {}
    plan: str = "basic"
    created_at: datetime = None
    updated_at: datetime = None
    status: str = "active"

# ========== 用户 ==========
class User(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    password_hash: Optional[str] = None
    roles: List[str] = ["employee"]
    position: Optional[str] = None
    department_id: Optional[str] = None
    config: Dict[str, Any] = {}
    created_at: datetime = None
    updated_at: datetime = None
    last_login_at: Optional[datetime] = None
    status: str = "active"

# ========== 部门 ==========
class Department(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    parent_id: Optional[str] = None
    name: str
    level: int = 1
    path: Optional[str] = None
    manager_id: Optional[str] = None
    created_at: datetime = None

# ========== 项目 ==========
class Project(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    name: str
    no: Optional[str] = None  # 项目编号
    status: str = "pending"  # pending/in_progress/completed/finished
    owner_id: Optional[str] = None  # 负责人
    progress: float = 0
    budget: float = 0
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    address: Optional[str] = None
    description: Optional[str] = None
    config: Dict[str, Any] = {}  # 自定义字段
    created_at: datetime = None
    updated_at: datetime = None
    status: str = "active"

# ========== 项目成员 ==========
class ProjectMember(BaseModel):
    project_id: str
    user_id: str
    role: str = "member"  # owner/manager/member
    joined_at: datetime = None

# ========== 任务 ==========
class Task(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    project_id: str
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    creator_id: Optional[str] = None
    priority: str = "normal"  # low/normal/high
    status: str = "pending"  # pending/in_progress/review/completed/delayed
    progress: float = 0
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    config: Dict[str, Any] = {}
    created_at: datetime = None
    updated_at: datetime = None
    status: str = "active"

# ========== 考勤记录 ==========
class Attendance(BaseModel):
    id: str = str(uuid.uuid4())
    user_id: str
    project_id: Optional[str] = None
    type: str = "check_in"  # check_in/check_out
    check_time: datetime = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime = None

# ========== 审批流程 ==========
class ApprovalFlow(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    code: str
    name: str
    object_type: str = "any"  # 适用的业务对象类型
    steps: List[Dict] = []  # 流程步骤定义
    conditions: Dict[str, Any] = {}
    created_at: datetime = None
    updated_at: datetime = None
    status: str = "active"

# ========== 审批实例 ==========
class Approval(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    flow_id: str
    record_id: str  # 关联的业务记录
    applicant_id: str  # 申请人
    title: str
    amount: float = 0
    current_step: int = 1
    steps_data: List[Dict] = []
    status: str = "pending"  # pending/approved/rejected/paid
    created_at: datetime = None
    resolved_at: Optional[datetime] = None

# ========== 审批日志 ==========
class ApprovalLog(BaseModel):
    id: str = str(uuid.uuid4())
    approval_id: str
    step: int
    approver_id: str
    action: str  # approve/reject/return
    comment: Optional[str] = None
    created_at: datetime = None

# ========== 操作日志 ==========
class OperationLog(BaseModel):
    id: str = str(uuid.uuid4())
    user_id: str
    action: str
    target_type: str
    target_id: str
    detail: Dict[str, Any] = {}
    created_at: datetime = None

# ========== 记忆 ==========
class MemoryIn(BaseModel):
    memory_id: str
    partner_id: str
    content: str
    type: str = "fact"  # fact/opinion/preference/event/chat_record
    source: str = "manual"  # manual/chat/extracted
    round: int = 0
    priority: int = 1
    tags: List[str] = []
    metadata: Dict[str, Any] = {}

# ========== 配方 ==========
class Recipe(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    name: str
    description: Optional[str] = None
    ingredients: List[Dict[str, Any]] = []
    steps: List[Dict[str, Any]] = []
    category: Optional[str] = None
    status: str = "active"
    created_by: Optional[str] = None
    created_at: datetime = None
    updated_at: datetime = None

# ========== 样板图片 ==========
class TemplateImage(BaseModel):
    id: str = str(uuid.uuid4())
    tenant_id: str
    name: str
    description: Optional[str] = None
    image_url: str
    category: Optional[str] = None
    tags: List[str] = []
    created_by: Optional[str] = None
    created_at: datetime = None
    updated_at: datetime = None
