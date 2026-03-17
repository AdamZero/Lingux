# 项目管理模块规格

**模块编号**: 02-project  
**模块名称**: 项目管理  
**版本**: v1.0  
**最后更新**: 2026-03-17  

---

## 1. 模块概述

### 1.1 功能范围

本模块负责项目的创建、配置和管理，包括：
- 项目 CRUD 操作
- 语言环境管理
- 命名空间管理
- 项目成员管理

### 1.2 关联模块

| 模块 | 关系 | 说明 |
|------|------|------|
| 01-auth | 依赖 | 需要用户认证后才能操作项目 |
| 03-key | 被依赖 | 项目包含多个 Key |
| 04-translation | 被依赖 | 项目下的翻译工作流 |

---

## 2. 功能规格

### 2.1 项目 CRUD

**功能 ID**: PROJ-001  
**功能名称**: 项目创建

#### 功能描述

用户可以创建新的翻译项目，配置项目的基本信息和语言环境。

#### 详细规则

1. **项目信息**
   - 项目名称：必填，2-50 字符，同一企业内唯一
   - 项目标识：自动生成，用于 API 调用（slug 格式）
   - 项目描述：可选，最多 500 字符
   - 项目图标：可选，支持上传或选择预设图标

2. **源语言设置**
   - 必须指定一个源语言（默认：简体中文 zh-CN）
   - 源语言创建后不可修改

3. **目标语言设置**
   - 至少选择一个目标语言
   - 支持的语言列表从系统预设获取
   - 可随时添加/移除目标语言（移除时提示会影响已有翻译）

4. **创建流程**
   ```
   填写项目信息 → 选择源语言 → 选择目标语言 → 创建成功 → 进入项目
   ```

#### 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| 项目名称已存在 | 返回错误，提示更换名称 |
| 未选择目标语言 | 表单校验失败，提示至少选择一种 |
| 创建失败 | 记录日志，返回友好错误信息 |

**功能 ID**: PROJ-002  
**功能名称**: 项目列表与详情

#### 功能描述

用户可以查看自己有权限的项目列表，以及项目的详细信息。

#### 详细规则

1. **项目列表**
   - 支持分页展示
   - 支持按名称搜索
   - 支持按创建时间排序
   - 显示项目进度（翻译覆盖率）

2. **项目卡片信息**
   ```
   - 项目名称
   - 项目描述（摘要）
   - 语言数量（源语言 + 目标语言）
   - Key 数量
   - 翻译覆盖率
   - 最后更新时间
   - 项目成员数量
   ```

3. **项目详情**
   - 基本信息（名称、描述、创建时间等）
   - 语言配置
   - 统计信息（Key 数、翻译数、覆盖率等）
   - 最近活动

**功能 ID**: PROJ-003  
**功能名称**: 项目编辑与删除

#### 功能描述

项目管理员可以编辑项目信息或删除项目。

#### 详细规则

1. **可编辑字段**
   - 项目名称
   - 项目描述
   - 项目图标
   - 目标语言（添加/移除）

2. **不可修改字段**
   - 项目标识（slug）
   - 源语言

3. **删除项目**
   - 仅 ADMIN 可删除
   - 删除前需二次确认
   - 删除后数据进入回收站（保留 30 天）
   - 支持从回收站恢复

### 2.2 语言环境管理

**功能 ID**: PROJ-004  
**功能名称**: 语言环境配置

#### 功能描述

管理项目支持的语言环境，包括源语言和目标语言。

#### 详细规则

1. **语言属性**
   ```typescript
   interface ProjectLocale {
     localeId: string;      // 关联 Locale
     isSource: boolean;     // 是否为源语言
     isEnabled: boolean;    // 是否启用
     fallbackOrder: number; // 回退优先级
   }
   ```

2. **源语言**
   - 有且只有一个
   - 创建时确定，不可修改
   - 作为翻译的基准语言

3. **目标语言**
   - 可以有多个
   - 支持动态添加/移除
   - 移除时提示会删除该语言的所有翻译

4. **语言回退**
   - 当目标语言翻译缺失时，按回退优先级查找替代
   - 默认回退链：目标语言 → 源语言

**支持的语言列表**:

| 语言代码 | 语言名称 | 常用程度 |
|----------|----------|----------|
| zh-CN | 简体中文 | ⭐⭐⭐ |
| zh-TW | 繁体中文 | ⭐⭐⭐ |
| en-US | 英语（美国）| ⭐⭐⭐ |
| ja-JP | 日语 | ⭐⭐⭐ |
| ko-KR | 韩语 | ⭐⭐ |
| fr-FR | 法语 | ⭐⭐ |
| de-DE | 德语 | ⭐⭐ |
| es-ES | 西班牙语 | ⭐⭐ |
| ru-RU | 俄语 | ⭐ |
| pt-BR | 葡萄牙语（巴西）| ⭐ |
| it-IT | 意大利语 | ⭐ |
| ... | 更多语言 | |

### 2.3 命名空间管理

**功能 ID**: PROJ-005  
**功能名称**: 命名空间 CRUD

#### 功能描述

命名空间用于对 Key 进行逻辑分组，如按功能模块、页面等维度划分。

#### 详细规则

1. **命名空间属性**
   ```typescript
   interface Namespace {
     id: string;
     projectId: string;
     name: string;           // 命名空间名称（唯一）
     description?: string;   // 描述
     priority: number;       // 排序优先级
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **命名规则**
   - 名称格式：小写字母、数字、下划线、连字符
   - 长度：1-50 字符
   - 同一项目内唯一
   - 示例：`common`, `auth`, `user_profile`, `order-management`

3. **默认命名空间**
   - 每个项目自动创建 `default` 命名空间
   - 未指定命名空间的 Key 归入 default

4. **命名空间用途**
   - 逻辑分组：按功能模块划分
   - 权限控制：可按命名空间设置编辑权限
   - 发布范围：可按命名空间选择发布范围
   - 导入导出：可按命名空间筛选

**功能 ID**: PROJ-006  
**功能名称**: 命名空间排序

#### 功能描述

支持对命名空间进行排序，影响展示顺序和导出顺序。

#### 详细规则

- 支持拖拽排序
- 支持设置优先级数值
- 默认按创建时间排序

### 2.4 项目成员管理

**功能 ID**: PROJ-007  
**功能名称**: 成员管理

#### 功能描述

管理项目的成员，包括邀请、移除、修改角色等操作。

#### 详细规则

1. **成员角色**
   | 角色 | 权限 |
   |------|------|
   | ADMIN | 所有操作，包括删除项目、管理成员 |
   | EDITOR | Key CRUD，翻译编辑，提交审核 |
   | REVIEWER | 审核翻译，查看所有内容 |
   | VIEWER | 只读访问 |

2. **邀请成员**
   - 支持通过用户名/邮箱搜索邀请
   - 支持生成邀请链接
   - 支持设置过期时间
   - 被邀请人接受后成为项目成员

3. **移除成员**
   - ADMIN 可以移除其他成员
   - 不能移除自己（需要转移所有权）
   - 移除后保留该成员的历史操作记录

4. **权限粒度（高级）**
   - 可按命名空间设置权限
   - 可按语言设置权限
   - 示例：某成员只能编辑 `auth` 命名空间的 `en-US` 语言

---

## 3. 数据模型

### 3.1 Project 模型

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  slug        String   // URL 友好的标识
  description String?
  icon        String?  // 图标 URL
  
  // 关联
  users       User[]   @relation("ProjectUsers")
  locales     ProjectLocale[]
  namespaces  Namespace[]
  keys        Key[]
  releases    Release[]
  
  // 审计
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String   // 创建者 userId
  
  @@unique([slug])
}

model ProjectLocale {
  id       String @id @default(cuid())
  projectId String
  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  localeId String
  locale   Locale  @relation(fields: [localeId], references: [id])
  
  isSource      Boolean @default(false)
  isEnabled     Boolean @default(true)
  fallbackOrder Int     @default(0)
  
  @@unique([projectId, localeId])
}

model Locale {
  id       String @id @default(cuid())
  code     String @unique // zh-CN, en-US, etc.
  name     String // 简体中文, English, etc.
  nativeName String // 中文, English, etc.
  
  projects ProjectLocale[]
}
```

### 3.2 Namespace 模型

```prisma
model Namespace {
  id          String @id @default(cuid())
  projectId   String
  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  name        String
  description String?
  priority    Int    @default(0)
  
  keys        Key[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([projectId, name])
}
```

### 3.3 ProjectMember 模型

```prisma
model ProjectMember {
  id        String @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role      ProjectRole @default(EDITOR)
  
  // 细粒度权限（可选）
  namespacePermissions Json? // { namespaceId: { canEdit: boolean } }
  localePermissions    Json? // { localeCode: { canEdit: boolean } }
  
  joinedAt  DateTime @default(now())
  
  @@unique([projectId, userId])
}

enum ProjectRole {
  ADMIN
  EDITOR
  REVIEWER
  VIEWER
}
```

---

## 4. 接口定义

### 4.1 项目接口

#### GET /api/v1/projects

**功能**: 获取项目列表  
**权限**: 登录用户  
**查询参数**:
- `page`: 页码，默认 1
- `limit`: 每页数量，默认 20
- `search`: 搜索关键词（项目名称）
- `sort`: 排序字段（createdAt/updatedAt/name）
- `order`: 排序方向（asc/desc）

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "cuid",
        "name": "My Project",
        "slug": "my-project",
        "description": "项目描述",
        "icon": "https://...",
        "locales": [
          { "code": "zh-CN", "name": "简体中文", "isSource": true },
          { "code": "en-US", "name": "英语", "isSource": false }
        ],
        "keyCount": 150,
        "translationCoverage": 85.5,
        "memberCount": 5,
        "updatedAt": "2026-03-17T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### POST /api/v1/projects

**功能**: 创建项目  
**权限**: 登录用户  
**请求体**:
```json
{
  "name": "My Project",
  "description": "项目描述",
  "icon": "https://...",
  "sourceLocale": "zh-CN",
  "targetLocales": ["en-US", "ja-JP"]
}
```

**响应**: 返回创建的项目详情

#### GET /api/v1/projects/:id

**功能**: 获取项目详情  
**权限**: 项目成员  
**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "cuid",
    "name": "My Project",
    "slug": "my-project",
    "description": "项目描述",
    "icon": "https://...",
    "locales": [...],
    "namespaces": [...],
    "stats": {
      "keyCount": 150,
      "translationCount": 450,
      "coverageByLocale": {
        "en-US": 90,
        "ja-JP": 75
      }
    },
    "createdAt": "2026-03-17T10:00:00Z",
    "updatedAt": "2026-03-17T10:00:00Z"
  }
}
```

#### PATCH /api/v1/projects/:id

**功能**: 更新项目  
**权限**: ADMIN  
**请求体**:
```json
{
  "name": "New Name",
  "description": "New Description",
  "icon": "https://..."
}
```

#### DELETE /api/v1/projects/:id

**功能**: 删除项目  
**权限**: ADMIN  
**说明**: 软删除，进入回收站

### 4.2 命名空间接口

#### GET /api/v1/projects/:projectId/namespaces

**功能**: 获取命名空间列表  
**权限**: 项目成员  
**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "cuid",
      "name": "common",
      "description": "通用文案",
      "priority": 0,
      "keyCount": 50
    }
  ]
}
```

#### POST /api/v1/projects/:projectId/namespaces

**功能**: 创建命名空间  
**权限**: EDITOR 及以上  
**请求体**:
```json
{
  "name": "auth",
  "description": "认证相关文案"
}
```

#### PATCH /api/v1/projects/:projectId/namespaces/:id

**功能**: 更新命名空间  
**权限**: EDITOR 及以上

#### DELETE /api/v1/projects/:projectId/namespaces/:id

**功能**: 删除命名空间  
**权限**: ADMIN  
**说明**: 删除命名空间会将其下的 Key 移动到 default 命名空间

### 4.3 成员接口

#### GET /api/v1/projects/:projectId/members

**功能**: 获取项目成员列表  
**权限**: 项目成员

#### POST /api/v1/projects/:projectId/members

**功能**: 邀请成员  
**权限**: ADMIN  
**请求体**:
```json
{
  "userId": "cuid",
  "role": "EDITOR"
}
```

#### PATCH /api/v1/projects/:projectId/members/:userId

**功能**: 修改成员角色  
**权限**: ADMIN

#### DELETE /api/v1/projects/:projectId/members/:userId

**功能**: 移除成员  
**权限**: ADMIN

---

## 5. 验收标准

- [ ] 项目创建成功，自动生成 slug
- [ ] 项目列表支持分页和搜索
- [ ] 项目详情展示完整统计信息
- [ ] 源语言创建后不可修改
- [ ] 目标语言可以动态添加/移除
- [ ] 命名空间 CRUD 功能正常
- [ ] 命名空间名称在同一项目内唯一
- [ ] 成员邀请和角色管理功能正常
- [ ] 删除项目进入回收站，支持恢复
