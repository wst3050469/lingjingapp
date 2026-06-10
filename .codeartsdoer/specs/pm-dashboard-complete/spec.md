# 项目经理看板完整实现 — 完成规格

## 状态：✅ 全部完成（v1.70.0）

所有规格项及建议项已实现并部署至生产环境。

## 选项完成记录

### 选项 A: FC06 — tools/builtin 源文件补全 ✅ v1.69.1
- 33个 `.ts` 源文件已创建于 `packages/core/src/tools/builtin/`
- `index.ts` 改为从 src 导入

### 选项 B: FC10 — skills/ 源文件目录 ✅ v1.69.1
- `packages/core/src/skills/types.ts`（Skill 类型）
- `packages/core/src/skills/loader.ts`（SkillLoader 类）
- `packages/core/src/skills/harvester.ts`（Harvester 函数）

### 选项 C: FC31 — 租户资源配额管理 ✅ v1.70.0
- 数据库: `tenant_usage` 表 (6列)
- 服务层: `services/quota_service.py` (135行, 4等级套餐)
- API: GET/PUT `/admin/tenants/{id}/quota` + GET `/plans`
- 中间件: `dependencies/quota.py` - `require_quota(resource)` FastAPI Dependency

### 选项 D: 看板模块 CRUD 操作 ✅ v1.70.0
| 资源 | GET | POST | PUT | DELETE |
|------|:--:|:--:|:--:|:--:|
| 质量 | ✅ | ✅ | ✅ | ✅ |
| 考勤 | ✅ | - | ✅ | ✅ |
| 耗材 | ✅ | ✅ | ✅ | ✅ |
