# 机器翻译统计功能文档

## 功能概述

机器翻译统计功能提供了对本月翻译任务和成本的全面分析，包括：
- 月度翻译统计概览
- 按供应商分组的详细统计
- 翻译任务列表和详情查看

## 功能特性

### 1. 月度统计卡片

**位置**: 机器翻译设置页面顶部

**显示内容**:
- 📊 总字符数：本月所有翻译任务的字符总数
- 📝 总任务数：本月创建的翻译任务数量
- 🔧 活跃供应商：本月使用过的翻译供应商数量

**刷新机制**: 
- 自动刷新：每 5 分钟自动刷新一次
- 手动刷新：点击右上角"刷新"按钮

### 2. 供应商统计卡片

每个供应商显示：
- 供应商名称和类型
- 翻译字符数
- 任务数量
- 字符数占比（进度条显示）

### 3. 翻译任务列表

**表格列**:
- 发起人：任务创建者（头像 + 名称）
- 供应商：使用的翻译供应商
- 项目：关联的项目（如有）
- 词条数：任务包含的词条数量
- 字符数：翻译的总字符数
- 状态：任务状态（待处理/处理中/已完成/失败/部分失败）
- 时间：任务创建时间（相对时间显示）

**交互功能**:
- 点击任务行查看任务详情
- 详情弹窗显示：
  - 基本信息（发起人、供应商、项目、时间等）
  - 多语言翻译结果明细
  - 每个词条的状态和翻译内容

## API 接口

### GET /api/v1/translation-providers/monthly-stats

获取月度翻译统计

**查询参数**:
- `year`: 年份（可选，默认当前年）
- `month`: 月份（可选，默认当前月）

**响应示例**:
```json
{
  "totalCharacters": 12345,
  "totalJobs": 50,
  "providers": [
    {
      "providerId": "xxx",
      "providerName": "Google Translate",
      "providerType": "GOOGLE",
      "characterCount": 8000,
      "jobCount": 30,
      "percentage": 64.81
    }
  ]
}
```

**缓存策略**: 5 分钟

### GET /api/v1/translation-providers/jobs

获取翻译任务列表

**查询参数**:
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `userId`: 按用户筛选（可选）
- `providerId`: 按供应商筛选（可选）
- `projectId`: 按项目筛选（可选）
- `status`: 按状态筛选（可选）
- `startDate`: 开始日期（可选）
- `endDate`: 结束日期（可选）

**响应示例**:
```json
{
  "items": [
    {
      "id": "xxx",
      "providerId": "xxx",
      "providerName": "Google Translate",
      "providerType": "GOOGLE",
      "userName": "张三",
      "userAvatar": "avatar_url",
      "projectName": "测试项目",
      "totalKeys": 10,
      "characterCount": 500,
      "status": "COMPLETED",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

**缓存策略**: 1 分钟

### GET /api/v1/translation-providers/jobs/:id

获取翻译任务详情

**路径参数**:
- `id`: 任务 ID

**响应示例**:
```json
{
  "id": "xxx",
  "provider": {
    "id": "xxx",
    "name": "Google Translate",
    "type": "GOOGLE"
  },
  "user": {
    "id": "xxx",
    "name": "张三",
    "avatar": "avatar_url"
  },
  "project": {
    "id": "xxx",
    "name": "测试项目"
  },
  "status": "COMPLETED",
  "sourceLanguage": "zh-CN",
  "targetLanguages": ["en-US", "ja-JP"],
  "totalKeys": 10,
  "translatedKeys": 10,
  "characterCount": 500,
  "items": [
    {
      "id": "xxx",
      "keyId": "xxx",
      "keyName": "welcome_message",
      "namespaceName": "common",
      "sourceContent": "欢迎",
      "translations": [
        {
          "id": "xxx",
          "targetLanguage": "en-US",
          "translatedContent": "Welcome",
          "status": "SUCCESS",
          "characterCount": 7
        },
        {
          "id": "xxx",
          "targetLanguage": "ja-JP",
          "translatedContent": "ようこそ",
          "status": "SUCCESS",
          "characterCount": 5
        }
      ]
    }
  ]
}
```

## 数据模型

### TranslationJob（翻译任务）

```prisma
model TranslationJob {
  id                String            @id @default(cuid())
  providerId        String
  projectId         String?
  userId            String?
  status            TranslationJobStatus @default(PENDING)
  sourceLanguage    String
  targetLanguages   String[]
  totalKeys         Int
  translatedKeys    Int @default(0)
  characterCount    Int
  error             String?
  createdAt         DateTime          @default(now())
  completedAt       DateTime?
  
  provider          TranslationProvider @relation(fields: [providerId], references: [id])
  user              User?               @relation(fields: [userId], references: [id])
  project           Project?            @relation(fields: [projectId], references: [id])
  items             TranslationJobItem[]
}
```

### TranslationJobItem（翻译任务明细）

```prisma
model TranslationJobItem {
  id                String                @id @default(cuid())
  jobId             String
  keyId             String
  keyName           String
  namespaceName     String?
  sourceContent     String
  translations      TranslationJobItemTranslation[]
  createdAt         DateTime              @default(now())
  
  job               TranslationJob        @relation(fields: [jobId], references: [id])
  key               Key                   @relation(fields: [keyId], references: [id])
}
```

### TranslationJobItemTranslation（翻译结果）

```prisma
model TranslationJobItemTranslation {
  id                String                @id @default(cuid())
  itemId            String
  targetLanguage    String
  translatedContent String?
  status            TranslationJobItemStatus @default(SUCCESS)
  errorMessage      String?
  characterCount    Int
  createdAt         DateTime              @default(now())
  
  item              TranslationJobItem    @relation(fields: [itemId], references: [id])
  
  @@unique([itemId, targetLanguage])
}
```

## 任务状态

- `PENDING`: 待处理
- `PROCESSING`: 处理中
- `COMPLETED`: 已完成
- `FAILED`: 失败
- `PARTIAL`: 部分失败

## 翻译结果状态

- `SUCCESS`: 翻译成功
- `FAILED`: 翻译失败
- `SKIPPED`: 已跳过

## 性能优化

### 缓存策略

1. **月度统计 API**: 5 分钟缓存
   - 缓存键：`translation:monthly-stats`
   - 适用场景：数据变化不频繁，可接受短暂延迟

2. **任务列表 API**: 1 分钟缓存
   - 缓存键：`translation:jobs:list`
   - 适用场景：任务状态变化较快，需要较短缓存时间

### 数据库索引

```prisma
// TranslationJob 表索引
@@index([providerId, createdAt])
@@index([projectId, status])
@@index([createdAt])
@@index([userId, createdAt])
```

### 查询优化

- 使用 `groupBy` 聚合查询减少数据库往返
- 批量查询供应商信息减少 N+1 查询
- 使用 `include` 预加载关联数据

## E2E 测试

测试文件：`apps/frontend/e2e/translation/machine-translation-analytics.spec.ts`

**测试用例**:
- MTA-001: 月度统计卡片显示
- MTA-002: 总字符数显示
- MTA-003: 供应商统计卡片显示
- MTA-004: 翻译任务列表显示
- MTA-005: 任务列表表格列显示
- MTA-006: 任务详情弹窗
- MTA-007: 任务详情显示翻译结果
- MTA-008: 供应商进度条显示
- MTA-009: 页面加载性能
- MTA-010: 数据刷新功能

**运行测试**:
```bash
cd apps/frontend
npx playwright test e2e/translation/machine-translation-analytics.spec.ts
```

## 使用场景

### 场景 1：查看本月翻译成本

1. 进入机器翻译设置页面
2. 查看顶部统计卡片的总字符数
3. 查看各供应商的字符数分布

### 场景 2：分析翻译任务详情

1. 在任务列表中找到目标任务
2. 点击任务行打开详情弹窗
3. 查看每个词条的多语言翻译结果
4. 检查翻译状态和质量

### 场景 3：监控翻译任务状态

1. 定期查看任务列表
2. 关注状态为"处理中"的任务
3. 检查失败或部分失败的任务
4. 必要时重新执行翻译

## 注意事项

1. **并发控制**: 系统会自动检查已存在的成功翻译，避免重复翻译
2. **部分失败处理**: 支持部分失败状态，可以精确统计成功和失败的词条数
3. **数据刷新**: 前端每 5 分钟自动刷新统计数据，也可手动刷新
4. **权限要求**: 需要登录后才能访问翻译统计功能

## 相关文件

### 后端
- `apps/backend/src/translation/services/machine-translation.service.ts`
- `apps/backend/src/translation/machine-translation.controller.ts`
- `apps/backend/src/common/cache/` (缓存服务)

### 前端
- `apps/frontend/src/components/translation/MonthlyStatsSection.tsx`
- `apps/frontend/src/components/translation/TranslationJobList.tsx`
- `apps/frontend/src/components/translation/ProviderStatCard.tsx`
- `apps/frontend/src/api/machine-translation.ts`

### 测试
- `apps/frontend/e2e/translation/machine-translation-analytics.spec.ts`

### 数据库
- `apps/backend/prisma/schema.prisma`
