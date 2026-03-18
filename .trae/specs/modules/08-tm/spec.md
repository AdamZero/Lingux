# 翻译记忆模块规格

**模块编号**: 08-tm  
**模块名称**: 翻译记忆 (TM)  
**版本**: v1.0  
**最后更新**: 2026-03-17  
**迭代计划**: 第 3 迭代  

---

## 1. 模块概述

### 1.1 功能范围

翻译记忆（Translation Memory, TM）存储历史翻译，在新翻译时提供相似内容推荐，提高翻译效率和一致性。

**功能**：
- TM 数据存储
- 相似度匹配
- 实时推荐
- TM 导入导出

### 1.2 使用场景

- **相似文案**："欢迎回来" 和 "欢迎回来！" 可复用
- **重复内容**：多个页面共用 "确定"、"取消"
- **版本迭代**：新版本复用旧版本翻译

---

## 2. 功能规格

### 2.1 TM 数据结构

```typescript
interface TranslationMemory {
  id: string;
  projectId?: string;           // null 表示全局 TM
  sourceText: string;
  sourceLocale: string;
  targetText: string;
  targetLocale: string;
  context?: {
    keyName?: string;
    namespace?: string;
    pagePath?: string;
  };
  quality: number;              // 质量评分 0-100
  usageCount: number;           // 被使用次数
  lastUsedAt?: Date;
  createdAt: Date;
}
```

### 2.2 相似度匹配算法

**匹配类型**：
| 匹配率 | 类型 | 颜色标识 | 建议操作 |
|--------|------|----------|----------|
| 100% | 完全匹配 | 绿色 | 一键采纳 |
| 95-99% | 高匹配 | 浅绿 | 参考后采纳 |
| 85-94% | 中高匹配 | 黄色 | 参考修改 |
| 75-84% | 中匹配 | 橙色 | 仅供参考 |
| < 75% | 低匹配 | 灰色 | 忽略 |

**匹配算法**：
```typescript
function calculateSimilarity(source: string, tmSource: string): number {
  // 1. 标准化处理
  const normalized1 = normalize(source);
  const normalized2 = normalize(tmSource);
  
  // 2. 完全匹配检查
  if (normalized1 === normalized2) return 100;
  
  // 3. 编辑距离计算 (Levenshtein Distance)
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = (1 - distance / maxLength) * 100;
  
  // 4. 占位符差异惩罚
  const placeholderDiff = comparePlaceholders(source, tmSource);
  const adjustedSimilarity = similarity * (1 - placeholderDiff * 0.1);
  
  return Math.round(adjustedSimilarity);
}
```

### 2.3 TM 推荐界面

```
翻译编辑器
┌────────────────────────────────────────────┐
│ 原文: Hello, {name}! Welcome back.        │
│                                             │
│ 译文: [输入框...]                          │
│                                             │
│ ┌─ 翻译记忆推荐 ─────────────────────────┐ │
│ │ 🔥 100% 完全匹配                        │ │
│ │    "你好，{name}！欢迎回来。"           │ │
│ │    [一键采纳]                           │ │
│ │                                         │ │
│ │ ⚡ 92% 高匹配                           │ │
│ │    "您好，{name}！欢迎回来。"           │ │
│ │    [参考] [采纳并修改]                  │ │
│ │                                         │ │
│ │ 💡 85% 中匹配                           │ │
│ │    "你好，{name}！欢迎回来！"           │ │
│ │    [参考]                               │ │
│ └─────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### 2.4 TM 积累方式

1. **自动积累**：已发布的翻译自动进入 TM
2. **手动导入**：批量导入历史翻译
3. **第三方 TM**：导入 TMX 文件

---

## 3. 数据模型

```prisma
model TranslationMemory {
  id            String   @id @default(cuid())
  projectId     String?  // null 表示全局 TM
  project       Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  sourceText    String
  sourceLocale  String
  targetText    String
  targetLocale  String
  
  context       Json?    // { keyName, namespace, pagePath }
  quality       Int      @default(100)
  usageCount    Int      @default(0)
  lastUsedAt    DateTime?
  
  createdAt     DateTime @default(now())
  
  @@index([projectId, sourceLocale, targetLocale])
}
```

---

## 4. 接口定义

### 4.1 TM 查询接口

#### GET /api/v1/projects/:projectId/tm/search

**功能**: 搜索相似翻译  
**权限**: 项目成员  
**查询参数**:
- `text`: 待翻译文本
- `sourceLocale`: 源语言
- `targetLocale`: 目标语言
- `minMatch`: 最小匹配率（默认 75）

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "cuid",
      "matchRate": 100,
      "sourceText": "Hello",
      "targetText": "你好",
      "usageCount": 15
    }
  ]
}
```

### 4.2 TM 管理接口

#### POST /api/v1/projects/:projectId/tm/import

**功能**: 导入 TM  
**权限**: ADMIN  
**Content-Type**: `multipart/form-data`  
**支持格式**: TMX, CSV, JSON

#### GET /api/v1/projects/:projectId/tm/export

**功能**: 导出 TM  
**权限**: ADMIN

---

## 5. 验收标准

- [ ] TM 数据存储
- [ ] 相似度匹配算法
- [ ] 翻译编辑器实时推荐
- [ ] 一键采纳 TM 建议
- [ ] TM 导入导出
- [ ] 使用统计
