# 发布管理模块规格

**模块编号**: 06-release  
**模块名称**: 发布管理  
**版本**: v1.0  
**最后更新**: 2026-03-17

---

## 1. 模块概述

### 1.1 功能范围

本模块负责管理翻译的发布流程，包括发布创建、审批、执行和回滚。

**MVP 范围**：

- 发布创建和预览
- 发布审批流程
- 正式发布执行
- 发布回滚
- CDN 文件生成

### 1.2 关联模块

| 模块                    | 关系 | 说明                   |
| ----------------------- | ---- | ---------------------- |
| 05-quality              | 依赖 | 发布前必须通过质量门禁 |
| 10-developer-experience | 依赖 | 发布后生成 CDN 文件    |

---

## 2. 功能规格

### 2.1 发布生命周期

```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
   ↑       ↓           ↓
   └───────┴───────────┘
```

| 状态      | 说明           | 可执行操作             |
| --------- | -------------- | ---------------------- |
| DRAFT     | 草稿，准备中   | 编辑发布范围、提交审核 |
| IN_REVIEW | 审核中         | 通过/拒绝              |
| APPROVED  | 已通过，待发布 | 执行发布               |
| PUBLISHED | 已发布         | 回滚                   |

### 2.2 发布创建

**功能 ID**: RELEASE-001  
**功能名称**: 创建发布

#### 功能描述

创建一个新的发布，选择要发布的翻译范围。

#### 发布范围

1. **全量发布**：所有命名空间的所有翻译
2. **命名空间发布**：指定命名空间的翻译
3. **Key 级发布**：指定 Key 的翻译

#### 发布内容

```typescript
interface Release {
  id: string;
  projectId: string;
  version: number; // 版本号，自增
  status: ReleaseStatus;
  scope: ReleaseScope; // 发布范围
  description?: string; // 发布说明
  createdBy: string;
  createdAt: Date;
  publishedAt?: Date;
}

interface ReleaseScope {
  type: "all" | "namespaces" | "keys";
  namespaceIds?: string[];
  keyIds?: string[];
}
```

### 2.3 发布审批

**功能 ID**: RELEASE-002  
**功能名称**: 发布审批流程

#### 功能描述

发布需要经过审批才能执行。

#### 审批流程

1. **创建发布**（ADMIN）
   - 选择发布范围
   - 填写发布说明
   - 系统自动运行质量门禁

2. **质量门禁检查**（自动）
   - 检查所有待发布翻译
   - 有 error 级别问题则阻断

3. **审批人审核**（ADMIN）
   - 查看变更内容
   - 查看质量报告
   - 通过或拒绝

4. **执行发布**（ADMIN）
   - 生成 CDN 文件
   - 更新当前版本
   - 触发 Webhook

### 2.4 发布预览

**功能 ID**: RELEASE-003  
**功能名称**: 发布预览

#### 功能描述

在正式发布前预览将要发布的内容。

#### 预览内容

```json
{
  "version": 12,
  "scope": {
    "type": "all"
  },
  "changes": {
    "added": 23,
    "updated": 156,
    "deleted": 5
  },
  "byNamespace": [
    {
      "namespace": "common",
      "added": 5,
      "updated": 45
    }
  ],
  "qualityReport": {
    "passed": true,
    "issues": []
  }
}
```

### 2.5 发布回滚

**功能 ID**: RELEASE-004  
**功能名称**: 发布回滚

#### 功能描述

当发布出现问题时，可以快速回滚到上一版本。

#### 回滚规则

1. **快速回滚**：切换到上一版本（< 1 分钟）
2. **指定回滚**：回滚到任意历史版本
3. **回滚影响**：
   - 更新 currentReleaseId
   - 触发 Webhook（release.rolled_back）
   - 记录回滚日志

#### 回滚限制

- 不能回滚到已被删除的版本
- 回滚后原版本标记为 ROLLED_BACK

### 2.6 CDN 文件生成

**功能 ID**: RELEASE-005  
**功能名称**: CDN 文件生成

#### 功能描述

发布后自动生成 CDN 可访问的翻译文件。

#### 文件格式

```json
{
  "zh-CN": {
    "common": {
      "button": {
        "submit": "提交",
        "cancel": "取消"
      }
    }
  },
  "en-US": {
    "common": {
      "button": {
        "submit": "Submit",
        "cancel": "Cancel"
      }
    }
  }
}
```

#### 存储路径

```
/releases/{projectId}/{version}/translations.json
/releases/{projectId}/latest/translations.json -> 软链接到当前版本
```

---

## 3. 数据模型

```prisma
enum ReleaseStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  PUBLISHED
  ROLLED_BACK
}

model Release {
  id          String        @id @default(cuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  version     Int
  status      ReleaseStatus @default(DRAFT)
  description String?

  // 发布范围
  scopeType   String        // all, namespaces, keys
  scopeIds    String[]      // namespaceIds or keyIds

  // 关联
  artifacts   ReleaseArtifact[]

  // 审计
  createdBy   String
  createdAt   DateTime      @default(now())
  publishedAt DateTime?
  publishedBy String?

  @@unique([projectId, version])
}

model ReleaseArtifact {
  id        String @id @default(cuid())
  releaseId String
  release   Release @relation(fields: [releaseId], references: [id], onDelete: Cascade)

  localeCode String
  content    String    // JSON 内容

  createdAt  DateTime @default(now())

  @@unique([releaseId, localeCode])
}
```

---

## 4. 接口定义

### 4.1 发布管理接口

#### POST /api/v1/projects/:projectId/releases

**功能**: 创建发布  
**权限**: ADMIN  
**请求体**:

```json
{
  "description": "发布说明",
  "scope": {
    "type": "all"
  }
}
```

#### GET /api/v1/projects/:projectId/releases

**功能**: 获取发布列表  
**权限**: 项目成员

#### GET /api/v1/projects/:projectId/releases/:id

**功能**: 获取发布详情  
**权限**: 项目成员

#### POST /api/v1/projects/:projectId/releases/:id/preview

**功能**: 发布预览  
**权限**: ADMIN

#### POST /api/v1/projects/:projectId/releases/:id/approve

**功能**: 通过发布审核  
**权限**: ADMIN

#### POST /api/v1/projects/:projectId/releases/:id/reject

**功能**: 拒绝发布  
**权限**: ADMIN  
**请求体**:

```json
{
  "reason": "质量问题"
}
```

#### POST /api/v1/projects/:projectId/releases/:id/publish

**功能**: 执行发布  
**权限**: ADMIN

#### POST /api/v1/projects/:projectId/releases/:id/rollback

**功能**: 回滚发布  
**权限**: ADMIN

---

## 5. 验收标准

- [ ] 创建发布并指定范围
- [ ] 发布前自动质量检查
- [ ] 发布审批流程
- [ ] 发布预览功能
- [ ] 执行发布生成 CDN 文件
- [ ] 一键回滚功能
- [ ] 发布历史记录
- [ ] Webhook 触发
