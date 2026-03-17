# 词条管理模块规格

**模块编号**: 03-key  
**模块名称**: 词条管理  
**版本**: v1.0  
**最后更新**: 2026-03-17  

---

## 1. 模块概述

### 1.1 功能范围

本模块负责词条（Key）的管理，包括：
- Key 的 CRUD 操作
- Key 类型支持（TEXT/RICH_TEXT/ASSET）
- 标签和元数据管理
- 页面路径关联
- 截图关联
- 导入/导出功能

### 1.2 关联模块

| 模块 | 关系 | 说明 |
|------|------|------|
| 02-project | 依赖 | Key 属于某个项目 |
| 04-translation | 被依赖 | Key 包含多个翻译 |
| 06-release | 依赖 | 发布时选择 Key 范围 |

---

## 2. 功能规格

### 2.1 Key CRUD

**功能 ID**: KEY-001  
**功能名称**: Key 创建

#### 功能描述

创建新的词条，定义词条的标识、类型、描述等信息。

#### 详细规则

1. **Key 属性**
   ```typescript
   interface Key {
     id: string;
     name: string;           // Key 名称，如 "common.button.submit"
     type: KeyType;          // 类型：TEXT/RICH_TEXT/ASSET
     description?: string;   // 描述说明
     namespaceId: string;    // 所属命名空间
     projectId: string;      // 所属项目
     tags: string[];         // 标签
     metadata: Record<string, any>; // 元数据
     pagePath?: string;      // 关联页面路径
     screenshotId?: string;  // 关联截图
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **Key 命名规范**
   - 格式：点分层次结构，如 `模块.页面.元素.属性`
   - 示例：`common.button.submit`, `auth.login.title`, `user.profile.avatar.label`
   - 字符：字母、数字、下划线、点号
   - 长度：1-200 字符
   - 同一命名空间内唯一

3. **Key 类型**
   | 类型 | 说明 | 示例 |
   |------|------|------|
   | TEXT | 纯文本 | "Hello World" |
   | RICH_TEXT | 富文本（支持 HTML/Markdown）| "<b>Bold</b> text" |
   | ASSET | 静态资源（图片/音频/视频）| 资源 URL |

4. **创建流程**
   ```
   填写 Key 名称 → 选择类型 → 填写描述 → 选择命名空间 → 添加标签 → 创建成功
   ```

**功能 ID**: KEY-002  
**功能名称**: Key 列表与详情

#### 功能描述

查看项目中的 Key 列表，支持多种筛选和搜索条件。

#### 详细规则

1. **列表筛选条件**
   - 命名空间
   - Key 名称（模糊搜索）
   - 标签
   - 页面路径
   - 类型
   - 翻译状态（已翻译/未翻译/审核中）

2. **排序方式**
   - 创建时间
   - 更新时间
   - Key 名称
   - 优先级（自定义）

3. **Key 列表展示字段**
   ```
   - Key 名称
   - 类型标识
   - 源语言内容（摘要）
   - 各目标语言翻译状态
   - 标签
   - 最后更新时间
   ```

**功能 ID**: KEY-003  
**功能名称**: Key 编辑与删除

#### 功能描述

编辑 Key 的元数据或删除 Key。

#### 详细规则

1. **可编辑字段**
   - 描述
   - 标签
   - 元数据
   - 页面路径
   - 截图
   - 命名空间（移动到其他命名空间）

2. **不可修改字段**
   - Key 名称（修改会破坏已有引用）
   - Key 类型（类型变更影响翻译内容格式）

3. **删除 Key**
   - 软删除，保留历史数据
   - 删除前提示会同时删除所有翻译
   - 支持从回收站恢复

### 2.2 标签管理

**功能 ID**: KEY-004  
**功能名称**: 标签系统

#### 功能描述

为 Key 添加标签，便于分类和筛选。

#### 详细规则

1. **标签属性**
   - 名称：1-20 字符，支持中文、字母、数字
   - 颜色：预设颜色或自定义
   - 同一项目内唯一

2. **标签用途**
   - 分类：如 `v1.0`, `v2.0`, `urgent`
   - 状态：如 `needs-review`, `finalized`
   - 业务：如 `payment`, `user-profile`

3. **标签管理**
   - 创建/编辑/删除标签
   - 为 Key 添加/移除标签
   - 按标签筛选 Key

### 2.3 页面路径关联

**功能 ID**: KEY-005  
**功能名称**: 页面路径关联

#### 功能描述

将 Key 与页面路径关联，便于按页面维度管理和发布。

#### 详细规则

1. **路径格式**
   - 支持通配符：`/products/*`, `/user/{id}`
   - 支持精确路径：`/home`, `/about`
   - 多个路径用逗号分隔

2. **路径用途**
   - 筛选：查看某页面的所有 Key
   - 发布：按页面维度选择发布范围
   - 统计：计算页面翻译覆盖率

3. **路径解析**
   ```typescript
   // 示例：匹配 /products/123
   const patterns = ['/products/*', '/products/{id}'];
   const path = '/products/123';
   
   // 匹配结果：['/products/*']
   ```

### 2.4 截图关联

**功能 ID**: KEY-006  
**功能名称**: 截图上下文

#### 功能描述

为 Key 关联截图，提供翻译上下文。

#### 详细规则

1. **截图属性**
   ```typescript
   interface Screenshot {
     id: string;
     keyId: string;
     url: string;           // 图片 URL
     thumbnailUrl: string;  // 缩略图 URL
     width: number;
     height: number;
     annotations: Annotation[]; // 标注信息
     createdAt: Date;
   }
   
   interface Annotation {
     x: number;      // 标注位置 X
     y: number;      // 标注位置 Y
     width: number;  // 标注宽度
     height: number; // 标注高度
     text: string;   // 标注文字
   }
   ```

2. **截图上传**
   - 支持格式：PNG, JPG, WEBP
   - 最大尺寸：10MB
   - 自动压缩生成缩略图
   - 存储：对象存储（MinIO/S3）

3. **截图标注**
   - 在截图上框选区域
   - 添加文字说明
   - 高亮显示文案位置

4. **截图展示**
   - 翻译编辑器侧边栏显示
   - 支持缩放和拖拽
   - 点击标注跳转对应位置

### 2.5 导入/导出

**功能 ID**: KEY-007  
**功能名称**: 数据导入导出

#### 功能描述

支持多种格式的 Key 和翻译数据导入导出。

#### 详细规则

1. **支持格式**
   | 格式 | 导入 | 导出 | 说明 |
   |------|------|------|------|
   | JSON | ✅ | ✅ | i18next 格式 |
   | YAML | ✅ | ✅ | 层级结构 |
   | Excel | ✅ | ✅ | 表格形式，适合非技术用户 |
   | CSV | ✅ | ✅ | 简单表格 |
   | XLIFF | ✅ | ✅ | 行业标准格式 |

2. **JSON 格式示例**
   ```json
   {
     "common": {
       "button": {
         "submit": "Submit",
         "cancel": "Cancel"
       }
     },
     "auth": {
       "login": {
         "title": "Login",
         "username": "Username"
       }
     }
   }
   ```

3. **Excel 格式示例**
   | Key | zh-CN | en-US | ja-JP | Namespace | PagePath |
   |-----|-------|-------|-------|-----------|----------|
   | common.button.submit | 提交 | Submit | 送信 | common | / |
   | auth.login.title | 登录 | Login | ログイン | auth | /login |

4. **导入策略**
   - 新增：Key 不存在时创建
   - 更新：Key 存在时更新翻译
   - 跳过：Key 存在时跳过
   - 冲突处理：提示用户选择

5. **导出选项**
   - 选择命名空间
   - 选择语言
   - 选择 Key 范围
   - 包含页面路径/截图信息

---

## 3. 数据模型

```prisma
enum KeyType {
  TEXT
  RICH_TEXT
  ASSET
}

model Key {
  id          String   @id @default(cuid())
  name        String   // 如：common.button.submit
  type        KeyType  @default(TEXT)
  description String?
  
  // 关联
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  namespaceId String
  namespace   Namespace @relation(fields: [namespaceId], references: [id], onDelete: Cascade)
  
  // 翻译
  translations Translation[]
  
  // 标签（多对多）
  tags        Tag[]
  
  // 元数据
  metadata    Json?     // { pagePath: '/home', priority: 1 }
  pagePath    String?   // 页面路径，冗余存储便于查询
  
  // 截图
  screenshots Screenshot[]
  
  // 审计
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String   // 创建者 userId
  
  @@unique([namespaceId, name])
}

model Tag {
  id        String @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  name      String
  color     String @default("#1890ff")
  
  keys      Key[]
  
  createdAt DateTime @default(now())
  
  @@unique([projectId, name])
}

model Screenshot {
  id            String @id @default(cuid())
  keyId         String
  key           Key    @relation(fields: [keyId], references: [id], onDelete: Cascade)
  
  url           String
  thumbnailUrl  String
  width         Int
  height        Int
  annotations   Json?  // [{ x, y, width, height, text }]
  
  createdAt     DateTime @default(now())
  createdBy     String
}
```

---

## 4. 接口定义

### 4.1 Key 接口

#### GET /api/v1/projects/:projectId/keys

**功能**: 获取 Key 列表  
**权限**: 项目成员  
**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `search`: Key 名称搜索
- `namespaceId`: 命名空间筛选
- `tag`: 标签筛选
- `pagePath`: 页面路径筛选
- `type`: 类型筛选
- `status`: 翻译状态筛选

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "cuid",
        "name": "common.button.submit",
        "type": "TEXT",
        "description": "提交按钮",
        "namespace": { "id": "cuid", "name": "common" },
        "tags": [{ "id": "cuid", "name": "v1.0", "color": "#1890ff" }],
        "sourceContent": "Submit",
        "translationStatus": {
          "zh-CN": "translated",
          "en-US": "pending",
          "ja-JP": "pending"
        },
        "pagePath": "/",
        "updatedAt": "2026-03-17T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 100 }
  }
}
```

#### POST /api/v1/projects/:projectId/keys

**功能**: 创建 Key  
**权限**: EDITOR 及以上  
**请求体**:
```json
{
  "name": "common.button.submit",
  "type": "TEXT",
  "description": "提交按钮",
  "namespaceId": "cuid",
  "tags": ["v1.0"],
  "metadata": { "priority": 1 },
  "pagePath": "/"
}
```

#### GET /api/v1/projects/:projectId/keys/:id

**功能**: 获取 Key 详情  
**权限**: 项目成员

#### PATCH /api/v1/projects/:projectId/keys/:id

**功能**: 更新 Key  
**权限**: EDITOR 及以上

#### DELETE /api/v1/projects/:projectId/keys/:id

**功能**: 删除 Key  
**权限**: EDITOR 及以上

### 4.2 标签接口

#### GET /api/v1/projects/:projectId/tags

**功能**: 获取标签列表

#### POST /api/v1/projects/:projectId/tags

**功能**: 创建标签  
**请求体**:
```json
{
  "name": "v1.0",
  "color": "#1890ff"
}
```

#### POST /api/v1/projects/:projectId/keys/:keyId/tags

**功能**: 为 Key 添加标签  
**请求体**:
```json
{
  "tagIds": ["cuid1", "cuid2"]
}
```

### 4.3 截图接口

#### POST /api/v1/projects/:projectId/keys/:keyId/screenshots

**功能**: 上传截图  
**Content-Type**: `multipart/form-data`  
**请求参数**:
- `file`: 图片文件
- `annotations`: JSON 字符串，标注信息

#### GET /api/v1/projects/:projectId/keys/:keyId/screenshots

**功能**: 获取截图列表

#### DELETE /api/v1/projects/:projectId/screenshots/:id

**功能**: 删除截图

### 4.4 导入导出接口

#### POST /api/v1/projects/:projectId/import

**功能**: 导入数据  
**Content-Type**: `multipart/form-data`  
**请求参数**:
- `file`: 导入文件
- `format`: 格式（json/yaml/excel/csv/xliff）
- `strategy`: 导入策略（create/update/skip/ask）
- `namespaceId`: 指定命名空间

**响应**:
```json
{
  "code": 200,
  "data": {
    "importId": "cuid",
    "status": "processing",
    "total": 100,
    "processed": 0
  }
}
```

#### GET /api/v1/projects/:projectId/import/:importId

**功能**: 查询导入进度

#### POST /api/v1/projects/:projectId/export

**功能**: 导出数据  
**请求体**:
```json
{
  "format": "json",
  "namespaceIds": ["cuid1", "cuid2"],
  "localeCodes": ["zh-CN", "en-US"],
  "includePagePath": true,
  "includeScreenshots": false
}
```

**响应**: 返回下载链接

---

## 5. 验收标准

- [ ] Key CRUD 功能正常
- [ ] Key 名称在同一命名空间内唯一
- [ ] 支持 TEXT/RICH_TEXT/ASSET 三种类型
- [ ] 标签系统正常工作
- [ ] 页面路径关联和筛选正常
- [ ] 截图上传和展示正常
- [ ] JSON/YAML/Excel/CSV/XLIFF 导入导出正常
- [ ] 导入时支持冲突处理策略
- [ ] 导出时支持选择范围和格式
