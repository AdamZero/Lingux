# 术语库模块规格

**模块编号**: 07-glossary  
**模块名称**: 术语库  
**版本**: v1.0  
**最后更新**: 2026-03-17  
**迭代计划**: 第 3 迭代  

---

## 1. 模块概述

### 1.1 功能范围

术语库用于统一管理项目中的专业术语，确保翻译一致性。

**功能**：
- 术语定义与管理
- 多语言术语映射
- 术语审批工作流
- 实时术语提示

### 1.2 使用场景

- **产品名称**：如 "Lingux" 统一不翻译
- **专业术语**：如 "API"、"Webhook" 保持英文
- **品牌词汇**：如 "iPhone" 保持原样

---

## 2. 功能规格

### 2.1 术语数据结构

```typescript
interface GlossaryTerm {
  id: string;
  projectId: string;
  sourceTerm: string;           // 源语言术语
  sourceLocale: string;         // 源语言代码
  translations: {
    [localeCode: string]: {
      term: string;             // 目标语言术语
      status: 'draft' | 'approved' | 'deprecated';
      approvedBy?: string;
      approvedAt?: Date;
    }
  };
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  definition: string;           // 定义说明
  context: string;              // 使用场景
  forbidden: boolean;           // 是否禁用词
  caseSensitive: boolean;       // 是否区分大小写
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 术语审批工作流

```
术语创建/修改
     ↓
┌─────────┐
│  DRAFT  │
│ (草稿)  │
└────┬────┘
     │ 提交审批
     ↓
┌─────────┐
│PENDING  │
│(待审批) │
└────┬────┘
     │ 审批通过
     ↓
┌─────────┐     ┌─────────┐
│APPROVED │────►│DEPRECATED│
│(已生效) │     │(已废弃) │
└─────────┘     └─────────┘
```

### 2.3 术语实时提示

**提示时机**：
- 翻译编辑时实时检测
- 检测到术语时高亮显示
- 鼠标悬停显示术语定义

**提示样式**：
```
翻译编辑器
┌─────────────────────────────────────┐
│ 原文: Welcome to our platform      │
│                                     │
│ 译文: 欢迎使用我们的 [platform] ▼  │
│           术语提示: 应译为"平台"    │
│           当前: platform → 平台     │
│           [应用] [忽略] [查看详情]  │
└─────────────────────────────────────┘
```

### 2.4 术语一致性检查

**检查规则**：
1. 术语必须使用已批准的译法
2. 禁用词必须完全避免
3. 大小写敏感术语必须严格匹配

**检查结果**：
| 级别 | 说明 | 处理方式 |
|------|------|----------|
| ERROR | 使用禁用词 | 阻断发布 |
| WARNING | 术语译法不一致 | 警告，建议修改 |
| INFO | 发现未使用术语 | 提示参考 |

---

## 3. 数据模型

```prisma
model GlossaryTerm {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  sourceTerm  String
  sourceLocale String
  translations Json    // { localeCode: { term, status, approvedBy, approvedAt } }
  
  partOfSpeech String  // noun, verb, adj, adv, phrase
  definition   String?
  context      String?
  forbidden    Boolean @default(false)
  caseSensitive Boolean @default(false)
  
  status      String   @default("draft") // draft, pending, approved, deprecated
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  
  @@unique([projectId, sourceTerm])
}
```

---

## 4. 接口定义

### 4.1 术语管理接口

#### GET /api/v1/projects/:projectId/glossary

**功能**: 获取术语列表  
**权限**: 项目成员

#### POST /api/v1/projects/:projectId/glossary

**功能**: 创建术语  
**权限**: EDITOR 及以上  
**请求体**:
```json
{
  "sourceTerm": "platform",
  "sourceLocale": "en-US",
  "translations": {
    "zh-CN": { "term": "平台" }
  },
  "partOfSpeech": "noun",
  "definition": "软件运行的基础环境",
  "context": "技术文档中常用"
}
```

#### PATCH /api/v1/projects/:projectId/glossary/:id

**功能**: 更新术语  
**权限**: EDITOR 及以上

#### POST /api/v1/projects/:projectId/glossary/:id/approve

**功能**: 批准术语  
**权限**: REVIEWER 及以上

---

## 5. 验收标准

- [ ] 术语 CRUD 功能
- [ ] 多语言术语映射
- [ ] 术语审批工作流
- [ ] 翻译编辑器实时术语提示
- [ ] 术语一致性检查
- [ ] 禁用词拦截
