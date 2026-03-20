# 机器翻译任务详情与统计功能设计文档

**创建日期**: 2026-03-20  
**状态**: 设计中  
**作者**: Lingux Team

---

## 一、需求概述

### 1.1 业务目标

为机器翻译设置页面增加以下功能：

1. **翻译任务详情查看**
   - 查看本月所有翻译任务的详细信息
   - 支持查看每个任务的发起人、翻译词条列表、翻译结果、使用的供应商
   - 支持多维度筛选（发起人、供应商、项目、日期范围、状态）

2. **供应商字符统计**
   - 按供应商分别查看本月翻译字符总数
   - 支持查看各供应商的字符数占比
   - 数据准实时更新（延迟几分钟可接受）

### 1.2 用户故事

- **作为管理员**，我希望查看本月所有翻译任务的详情，以便了解翻译资源的使用情况
- **作为项目经理**，我希望按发起人筛选任务，以便了解团队成员的翻译活动
- **作为财务**，我希望查看各供应商的字符数统计，以便进行成本核算
- **作为开发者**我希望追溯具体翻译了哪些词条，以便排查翻译质量问题

---

## 二、数据库设计

### 2.1 Schema 变更

#### 2.1.1 修改 `TranslationJob` 表

**核心概念**：一个翻译任务 = 批量翻译一批词条到多个目标语言

```prisma
model TranslationJob {
  id                String             @id @default(cuid())
  providerId        String
  projectId         String?
  userId            String?            // 新增：发起人 ID（关联 User 表）
  status            TranslationJobStatus @default(PENDING)
  sourceLanguage    String
  targetLanguages   String[]           // ❗关键修改：目标语言数组（支持多语言）
  totalKeys         Int                // ❗新增：总词条数
  translatedKeys    Int @default(0)    // ❗新增：已翻译词条数（成功数）
  characterCount    Int
  error             String?
  createdAt         DateTime           @default(now()) @db.Timestamptz
  completedAt       DateTime?          @db.Timestamptz
  
  // 关联关系
  Provider          TranslationProvider  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  User              User?                @relation(fields: [userId], references: [id])
  Items             TranslationJobItem[]
  
  // 索引
  @@index([providerId, createdAt])
  @@index([projectId, status])
  @@index([createdAt])
  @@index([userId, createdAt])  // 新增：便于按用户查询
}
```

**变更说明：**
- 新增 `userId` 字段：记录翻译任务的发起人
- 删除 `texts[]` 和 `results[]` 字段：避免数据冗余，移至 `TranslationJobItem` 和 `TranslationJobItemTranslation`
- 将 `targetLanguage` 改为 `targetLanguages[]`：**关键修改**，支持一个任务翻译到多个语言
- 新增 `totalKeys` 和 `translatedKeys`：用于统计任务进度
- 新增与 `User` 表的关联关系
- 新增 `userId` 索引：优化按用户筛选的查询性能

#### 2.1.2 新增 `TranslationJobItem` 表

**核心概念**：一个 Item = 一个词条的翻译（可能包含多个语言的翻译结果）

```prisma
model TranslationJobItem {
  id                String                @id @default(cuid())
  jobId             String
  keyId             String                // 词条 ID
  keyName           String                // 词条名称（冗余存储，便于展示）
  namespaceName     String?               // ❗新增：命名空间名称（冗余，便于展示）
  sourceContent     String                // 原文内容
  
  // ❗关键修改：一对多关系，支持多语言翻译结果
  translations      TranslationJobItemTranslation[]
  
  createdAt         DateTime              @default(now()) @db.Timestamptz
  
  // 关联关系
  Job               TranslationJob        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  Key               Key                   @relation(fields: [keyId], references: [id])
  
  // 索引
  @@index([jobId])
  @@index([keyId])
}
```

**设计说明：**
- `keyName` 和 `namespaceName` 冗余存储：避免查询时需要关联 `Key` 和 `Namespace` 表
- `translations` 一对多关系：支持一个词条翻译到多个语言
- `onDelete: Cascade`：删除任务时自动删除关联的明细记录

#### 2.1.3 新增 `TranslationJobItemTranslation` 表

**核心概念**：一个翻译结果 = 一个词条的一个语言的翻译

```prisma
model TranslationJobItemTranslation {
  id                String                @id @default(cuid())
  itemId            String
  targetLanguage    String                // 目标语言
  translatedContent String?               // 翻译结果
  status            TranslationJobItemStatus @default(SUCCESS)
  errorMessage      String?
  characterCount    Int                   // 字符数（用于统计）
  createdAt         DateTime              @default(now()) @db.Timestamptz
  
  // 关联关系
  Item              TranslationJobItem    @relation(fields: [itemId], references: [id], onDelete: Cascade)
  
  // 索引
  @@index([itemId])
  @@unique([itemId, targetLanguage])      // 唯一约束：一个词条的一个语言只能有一个翻译结果
}

enum TranslationJobItemStatus {
  SUCCESS
  FAILED
  SKIPPED  // 已存在翻译，跳过
}
```

**设计说明：**
- 支持一个词条翻译到多个语言
- `characterCount` 用于精确统计每个语言的翻译字符数
- 唯一约束确保不会重复翻译同一个语言

#### 2.1.4 修改 `User` 表（可选）

```prisma
model User {
  // ... 现有字段
  TranslationJobs   TranslationJob[]  // 新增反向关联（可选，便于查询）
}
```

### 2.2 数据迁移策略

```sql
-- 1. 修改 TranslationJob 表
-- 1.1 添加 userId 字段（允许 NULL，因为历史数据没有发起人）
ALTER TABLE "TranslationJob" 
ADD COLUMN "userId" TEXT;

-- 1.2 修改 targetLanguage 为数组类型
ALTER TABLE "TranslationJob" 
ALTER COLUMN "targetLanguage" DROP NOT NULL;

-- 1.3 添加新字段
ALTER TABLE "TranslationJob" 
ADD COLUMN "targetLanguages" TEXT[],
ADD COLUMN "totalKeys" INTEGER,
ADD COLUMN "translatedKeys" INTEGER DEFAULT 0;

-- 1.4 迁移旧数据（将 targetLanguage 转为数组）
UPDATE "TranslationJob" 
SET "targetLanguages" = ARRAY["targetLanguage"]
WHERE "targetLanguage" IS NOT NULL;

-- 1.5 删除旧字段
ALTER TABLE "TranslationJob" 
DROP COLUMN "targetLanguage";

-- 1.6 添加外键约束
ALTER TABLE "TranslationJob" 
ADD CONSTRAINT "TranslationJob_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL;

-- 1.7 创建索引
CREATE INDEX "TranslationJob_userId_createdAt_idx" 
ON "TranslationJob"("userId", "createdAt");

-- 2. 创建新表 TranslationJobItem
CREATE TABLE "TranslationJobItem" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "keyName" TEXT NOT NULL,
  "namespaceName" TEXT,
  "sourceContent" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "TranslationJobItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TranslationJobItem_jobId_fkey" 
    FOREIGN KEY ("jobId") REFERENCES "TranslationJob"("id") ON DELETE CASCADE,
  CONSTRAINT "TranslationJobItem_keyId_fkey" 
    FOREIGN KEY ("keyId") REFERENCES "Key"("id")
);

-- 3. 创建新表 TranslationJobItemTranslation
CREATE TABLE "TranslationJobItemTranslation" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "targetLanguage" TEXT NOT NULL,
  "translatedContent" TEXT,
  "status" "TranslationJobItemStatus" NOT NULL DEFAULT 'SUCCESS',
  "errorMessage" TEXT,
  "characterCount" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "TranslationJobItemTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TranslationJobItemTranslation_itemId_fkey" 
    FOREIGN KEY ("itemId") REFERENCES "TranslationJobItem"("id") ON DELETE CASCADE,
  CONSTRAINT "TranslationJobItemTranslation_unique" 
    UNIQUE ("itemId", "targetLanguage")
);

-- 4. 创建索引
CREATE INDEX "TranslationJobItem_jobId_idx" ON "TranslationJobItem"("jobId");
CREATE INDEX "TranslationJobItem_keyId_idx" ON "TranslationJobItem"("keyId");
CREATE INDEX "TranslationJobItemTranslation_itemId_idx" ON "TranslationJobItemTranslation"("itemId");

-- 5. 迁移历史数据（可选）
-- 将旧的 TranslationJob 数据迁移到新表结构
-- 注意：这需要根据实际业务需求决定是否执行
```

---

## 三、API 设计

### 3.1 获取翻译任务列表

**接口**: `GET /api/translation-providers/jobs`

**请求参数**:
```typescript
interface GetTranslationJobsQuery {
  page?: number;           // 页码，默认 1
  pageSize?: number;       // 每页数量，默认 20
  userId?: string;         // 按发起人筛选
  providerId?: string;     // 按供应商筛选
  projectId?: string;      // 按项目筛选
  status?: string;         // 任务状态：PENDING/PROCESSING/COMPLETED/FAILED/PARTIAL
  startDate?: string;      // 开始日期（ISO 格式）
  endDate?: string;        // 结束日期（ISO 格式）
}
```

**响应格式**:
```typescript
interface TranslationJobListResponse {
  items: {
    id: string;
    providerName: string;      // 供应商名称
    providerType: string;      // 供应商类型
    userId: string | null;
    userName: string | null;   // 发起人姓名
    userAvatar: string | null; // 发起人头像
    projectId: string | null;
    projectName: string | null;// 项目名称
    status: string;
    sourceLanguage: string;
    targetLanguages: string[]; // ❗修改：目标语言数组
    totalKeys: number;         // 总词条数
    translatedKeys: number;    // ❗修改：已翻译词条数
    successCount: number;      // 成功词条数
    failedCount: number;       // 失败词条数
    characterCount: number;    // 总字符数
    createdAt: string;
    completedAt: string | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
}
```

**实现要点**:
```typescript
// MachineTranslationController
@Get('jobs')
async getTranslationJobs(
  @Query() query: GetTranslationJobsQuery,
) {
  const {
    page = 1,
    pageSize = 20,
    userId,
    providerId,
    projectId,
    status,
    startDate,
    endDate,
  } = query;

  // 构建查询条件
  const where: Prisma.TranslationJobWhereInput = {};
  
  if (userId) where.userId = userId;
  if (providerId) where.providerId = providerId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status as TranslationJobStatus;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  // 查询任务列表（带聚合）
  const [items, total] = await Promise.all([
    this.prisma.translationJob.findMany({
      where,
      include: {
        Provider: { select: { name: true, type: true } },
        User: { select: { name: true, avatar: true } },
        Project: { select: { name: true } },
        Items: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    this.prisma.translationJob.count({ where }),
  ]);

  // 格式化响应
  const formattedItems = items.map((job) => ({
    ...job,
    providerName: job.Provider.name,
    providerType: job.Provider.type,
    userName: job.User?.name || null,
    userAvatar: job.User?.avatar || null,
    projectName: job.Project?.name || null,
    totalKeys: job.Items.length,
    successCount: job.Items.filter((i) => i.status === 'SUCCESS').length,
    failedCount: job.Items.filter((i) => i.status === 'FAILED').length,
  }));

  return {
    items: formattedItems,
    total,
    page,
    pageSize,
  };
}
```

---

### 3.2 获取翻译任务详情

**接口**: `GET /api/translation-providers/jobs/:id`

**路径参数**:
```typescript
{
  id: string;  // 任务 ID
}
```

**响应格式**:
```typescript
interface TranslationJobDetailResponse {
  id: string;
  provider: {
    id: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  project?: {
    id: string;
    name: string;
  };
  status: string;
  sourceLanguage: string;
  targetLanguages: string[];  // ❗修改：目标语言数组
  totalKeys: number;
  translatedKeys: number;
  characterCount: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
  items: {
    id: string;
    keyId: string;
    keyName: string;
    namespaceName?: string;
    sourceContent: string;
    translations: {  // ❗修改：多语言翻译结果
      targetLanguage: string;
      translatedContent: string | null;
      status: string;
      errorMessage?: string | null;
      characterCount: number;
    }[];
  }[];
}
```

**实现要点**:
```typescript
@Get('jobs/:id')
async getTranslationJob(@Param('id') id: string) {
  const job = await this.prisma.translationJob.findUnique({
    where: { id },
    include: {
      Provider: { select: { id: true, name: true, type: true } },
      User: { select: { id: true, name: true, avatar: true } },
      Project: { select: { id: true, name: true } },
      Items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!job) {
    throw new NotFoundException(`Translation job ${id} not found`);
  }

  return {
    ...job,
    provider: job.Provider,
    user: job.User,
    project: job.Project,
    items: job.Items,
  };
}
```

---

### 3.3 获取本月供应商统计

**接口**: `GET /api/translation-providers/monthly-stats`

**请求参数**:
```typescript
interface GetMonthlyStatsQuery {
  year?: number;   // 年份，默认当前年
  month?: number;  // 月份，默认当前月
}
```

**响应格式**:
```typescript
interface MonthlyStatsResponse {
  totalCharacters: number;  // 本月总字符数
  totalJobs: number;        // 本月总任务数
  providers: {
    providerId: string;
    providerName: string;
    providerType: string;
    characterCount: number;  // 该供应商字符数
    jobCount: number;        // 该供应商任务数
    percentage: number;      // 占比（百分比）
  }[];
}
```

**实现要点**:
```typescript
@Get('monthly-stats')
async getMonthlyStats(
  @Query('year') year?: number,
  @Query('month') month?: number,
) {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  // 计算日期范围
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0);

  // 按供应商分组统计
  const stats = await this.prisma.translationJob.groupBy({
    by: ['providerId'],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      characterCount: true,
    },
    _count: true,
  });

  // 获取供应商信息
  const providerIds = stats.map((s) => s.providerId);
  const providers = await this.prisma.translationProvider.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, name: true, type: true },
  });

  // 计算总数
  const totalCharacters = stats.reduce(
    (sum, s) => sum + (s._sum.characterCount || 0),
    0,
  );
  const totalJobs = stats.reduce((sum, s) => sum + s._count, 0);

  // 格式化响应
  const providerStats = stats.map((stat) => {
    const provider = providers.find((p) => p.id === stat.providerId);
    const characterCount = stat._sum.characterCount || 0;
    return {
      providerId: stat.providerId,
      providerName: provider?.name || 'Unknown',
      providerType: provider?.type || 'Unknown',
      characterCount,
      jobCount: stat._count,
      percentage: totalCharacters > 0 
        ? Math.round((characterCount / totalCharacters) * 100 * 100) / 100 
        : 0,
    };
  });

  return {
    totalCharacters,
    totalJobs,
    providers: providerStats,
  };
}
```

---

### 3.4 创建翻译任务（增强版）

**接口**: `POST /api/translation-providers/jobs`

**请求体**:
```typescript
interface CreateTranslationJobDto {
  providerId?: string;
  sourceLanguage: string;
  targetLanguages: string[];  // ❗修改：目标语言数组
  projectId?: string;
  items: {  // 词条列表
    keyId: string;
    keyName: string;
    namespaceName?: string;
    sourceContent: string;
  }[];
}
```

**响应格式**:
```typescript
interface CreateTranslationJobResponse {
  jobId: string;
  status: string;
  message: string;
}
```

**实现要点**:
```typescript
@Post('jobs')
async createTranslationJob(
  @Body() dto: CreateTranslationJobDto,
  @User() user: { id: string },  // 从 JWT 获取当前用户
) {
  const { providerId, sourceLanguage, targetLanguages, projectId, items } = dto;

  // 使用默认供应商（如果未指定）
  const effectiveProviderId = providerId || await this.getDefaultProviderId();

  // 计算总字符数
  const totalCharacters = items.reduce(
    (sum, item) => sum + item.sourceContent.length,
    0
  );

  // 创建翻译任务
  const job = await this.prisma.translationJob.create({
    data: {
      providerId: effectiveProviderId,
      projectId,
      userId: user.id,  // 记录发起人
      status: TranslationJobStatus.PENDING,
      sourceLanguage,
      targetLanguages,  // ❗修改：目标语言数组
      totalKeys: items.length,  // ❗新增：总词条数
      translatedKeys: 0,
      characterCount: totalCharacters,
    },
  });

  // 创建翻译任务明细
  await this.prisma.translationJobItem.createMany({
    data: items.map((item) => ({
      jobId: job.id,
      keyId: item.keyId,
      keyName: item.keyName,
      namespaceName: item.namespaceName,
      sourceContent: item.sourceContent,
    })),
  });

  // 异步执行翻译
  this.executeTranslationJob(job.id).catch((error) => {
    this.logger.error(`Translation job ${job.id} failed:`, error);
  });

  return {
    jobId: job.id,
    status: 'PENDING',
    message: 'Translation job created',
  };
}
```

---

### 3.5 执行翻译任务（增强版）

**核心逻辑**：对每个目标语言执行批量翻译

**实现要点**:
```typescript
private async executeTranslationJob(jobId: string): Promise<void> {
  const job = await this.prisma.translationJob.findUnique({
    where: { id: jobId },
    include: { 
      Items: {
        include: {
          translations: true,  // 包含已有的翻译结果
        },
      },
    },
  });

  if (!job) {
    throw new NotFoundException(`Translation job ${jobId} not found`);
  }

  // 更新状态为处理中
  await this.prisma.translationJob.update({
    where: { id: jobId },
    data: { status: TranslationJobStatus.PROCESSING },
  });

  try {
    // 对每个目标语言执行翻译
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const targetLanguage of job.targetLanguages) {
      const texts = job.Items.map((item) => item.sourceContent);
      
      // 执行批量翻译
      const result = await this.translateBatch(job.providerId, texts, {
        sourceLanguage: job.sourceLanguage,
        targetLanguage,
      });

      // 为每个 Item 创建翻译结果
      for (let i = 0; i < job.Items.length; i++) {
        const item = job.Items[i];
        const translation = result.translations[i];
        
        // 创建或更新翻译结果
        await this.prisma.translationJobItemTranslation.upsert({
          where: {
            itemId_targetLanguage: {
              itemId: item.id,
              targetLanguage,
            },
          },
          update: {
            translatedContent: translation.translatedText,
            status: translation.error ? 'FAILED' : 'SUCCESS',
            errorMessage: translation.error || null,
            characterCount: translation.translatedText?.length || 0,
          },
          create: {
            itemId: item.id,
            targetLanguage,
            translatedContent: translation.translatedText,
            status: translation.error ? 'FAILED' : 'SUCCESS',
            errorMessage: translation.error || null,
            characterCount: translation.translatedText?.length || 0,
          },
        });

        // 统计成功/失败数
        if (translation.error) {
          totalFailed++;
        } else {
          totalSuccess++;
        }
      }

      // 记录翻译成本
      await this.recordTranslationCost(job.providerId, result.totalCharacters);
    }

    // 更新任务状态
    const hasFailures = totalFailed > 0;
    const allFailures = totalSuccess === 0 && totalFailed > 0;

    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: allFailures 
          ? TranslationJobStatus.FAILED 
          : hasFailures 
            ? TranslationJobStatus.PARTIAL 
            : TranslationJobStatus.COMPLETED,
        translatedKeys: totalSuccess,  // ❗更新已翻译词条数
        completedAt: new Date(),
      },
    });
  } catch (error) {
    // 更新任务为失败
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: TranslationJobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });

    // 更新所有 Items 的翻译结果为失败
    for (const targetLanguage of job.targetLanguages) {
      for (const item of job.Items) {
        await this.prisma.translationJobItemTranslation.upsert({
          where: {
            itemId_targetLanguage: {
              itemId: item.id,
              targetLanguage,
            },
          },
          update: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          create: {
            itemId: item.id,
            targetLanguage,
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}
```

---

## 四、前端设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  机器翻译设置                                      [添加供应商]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📊 本月翻译统计（2026-03）                               │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │  │
│  │  │ 总字符数     │ │ 总任务数     │ │ 活跃供应商   │         │  │
│  │  │  125,430    │ │    48       │ │     3       │         │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │  │
│  │                                                           │  │
│  │  按供应商统计：                                            │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │  │
│  │  │  Google      │ │   DeepL      │ │   百度       │      │  │
│  │  │  65%         │ │   25%        │ │   10%        │      │  │
│  │  │  81,530 字符  │ │  31,358 字符  │ │  12,542 字符  │      │  │
│  │  │  28 任务      │ │   15 任务     │ │    5 任务     │      │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  📋 翻译任务列表                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [发起人 ▼] [供应商 ▼] [项目 ▼] [日期范围 ▼] [状态 ▼] [🔍]   │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 发起人 │ 供应商  │ 项目   │ 词条数 │ 字符数 │ 状态 │ 时间   │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 👤张三 │ Google │ 项目 A │ 15/15  │ 2,340 │ ✅  │ 2 小时前  │ │
│  │ 👤李四 │ DeepL  │ 项目 B │ 8/10   │ 1,560 │ ⚠️  │ 5 小时前  │ │
│  │ 👤张三 │ 百度   │ 项目 A │ 20/20  │ 3,200 │ ✅  │ 1 天前    │ │
│  │ ...                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [1] [2] [3] ... [10]                                共 48 条   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 组件结构

```
MachineTranslationSettingsPage/
├── MonthlyStatsSection/           # 本月统计区域
│   ├── StatCard.tsx               # 统计卡片组件
│   └── ProviderStatsGrid.tsx      # 供应商统计网格
│
├── TranslationJobList/            # 任务列表区域
│   ├── JobFilters.tsx             # 筛选器组件
│   ├── JobTable.tsx               # 任务表格
│   └── JobPagination.tsx          # 分页组件
│
└── JobDetailModal/                # 任务详情弹窗
    ├── JobBasicInfo.tsx           # 基本信息
    └── JobItemsTable.tsx          # 翻译明细表格
```

### 4.3 API 调用（React Query）

```typescript
// src/api/machine-translation.ts

// 新增接口
export interface TranslationJob {
  id: string;
  providerName: string;
  providerType: string;
  userId: string | null;
  userName: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string;
  sourceLanguage: string;
  targetLanguage: string;
  totalKeys: number;
  successCount: number;
  failedCount: number;
  characterCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface MonthlyStats {
  totalCharacters: number;
  totalJobs: number;
  providers: {
    providerId: string;
    providerName: string;
    providerType: string;
    characterCount: number;
    jobCount: number;
    percentage: number;
  }[];
}

// 获取翻译任务列表
export const getTranslationJobs = async (
  params?: GetTranslationJobsQuery,
): Promise<TranslationJobListResponse> => {
  return apiClient.get('/translation-providers/jobs', { params });
};

// 获取翻译任务详情
export const getTranslationJobDetail = async (
  jobId: string,
): Promise<TranslationJobDetailResponse> => {
  return apiClient.get(`/translation-providers/jobs/${jobId}`);
};

// 获取本月统计
export const getMonthlyStats = async (
  params?: { year?: number; month?: number },
): Promise<MonthlyStats> => {
  return apiClient.get('/translation-providers/monthly-stats', { params });
};
```

### 4.4 关键组件实现

#### 4.4.1 本月统计卡片

```typescript
// src/components/translation/MonthlyStatsSection.tsx
export const MonthlyStatsSection: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['translation-monthly-stats'],
    queryFn: () => getMonthlyStats(),
  });

  if (isLoading) return <Skeleton />;

  return (
    <Card title="📊 本月翻译统计">
      <Row gutter={16}>
        <Col span={8}>
          <StatCard
            title="总字符数"
            value={stats?.totalCharacters.toLocaleString()}
            icon={<FieldStringOutlined />}
          />
        </Col>
        <Col span={8}>
          <StatCard
            title="总任务数"
            value={stats?.totalJobs}
            icon={<TaskOutlined />}
          />
        </Col>
        <Col span={8}>
          <StatCard
            title="活跃供应商"
            value={stats?.providers.length}
            icon={<AppstoreOutlined />}
          />
        </Col>
      </Row>

      <Divider />

      <Title level={5}>按供应商统计</Title>
      <Row gutter={16}>
        {stats?.providers.map((provider) => (
          <Col span={8} key={provider.providerId}>
            <ProviderStatCard provider={provider} />
          </Col>
        ))}
      </Row>
    </Card>
  );
};
```

#### 4.4.2 任务列表筛选器

```typescript
// src/components/translation/JobFilters.tsx
export const JobFilters: React.FC<{
  onFilter: (filters: JobFilters) => void;
}> = ({ onFilter }) => {
  const [filters, setFilters] = useState<JobFilters>({});

  // 获取发起人列表
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  });

  // 获取供应商列表
  const { data: providers } = useQuery({
    queryKey: ['translation-providers'],
    queryFn: getTranslationProviders,
  });

  // 获取项目列表
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  return (
    <Space wrap>
      <Select
        placeholder="发起人"
        allowClear
        style={{ width: 150 }}
        options={users?.map((u) => ({ label: u.name, value: u.id }))}
        onChange={(value) => setFilters({ ...filters, userId: value })}
      />

      <Select
        placeholder="供应商"
        allowClear
        style={{ width: 150 }}
        options={providers?.map((p) => ({ label: p.name, value: p.id }))}
        onChange={(value) => setFilters({ ...filters, providerId: value })}
      />

      <Select
        placeholder="项目"
        allowClear
        style={{ width: 150 }}
        options={projects?.map((p) => ({ label: p.name, value: p.id }))}
        onChange={(value) => setFilters({ ...filters, projectId: value })}
      />

      <RangePicker
        onChange={(dates) =>
          setFilters({
            ...filters,
            startDate: dates?.[0]?.toISOString(),
            endDate: dates?.[1]?.toISOString(),
          })
        }
      />

      <Select
        placeholder="状态"
        allowClear
        style={{ width: 120 }}
        options={[
          { label: '待处理', value: 'PENDING' },
          { label: '处理中', value: 'PROCESSING' },
          { label: '已完成', value: 'COMPLETED' },
          { label: '失败', value: 'FAILED' },
          { label: '部分失败', value: 'PARTIAL' },
        ]}
        onChange={(value) => setFilters({ ...filters, status: value })}
      />

      <Button
        type="primary"
        onClick={() => onFilter(filters)}
        icon={<SearchOutlined />}
      >
        查询
      </Button>
    </Space>
  );
};
```

#### 4.4.3 任务详情弹窗

```typescript
// src/components/translation/JobDetailModal.tsx
export const JobDetailModal: React.FC<{
  jobId: string | null;
  open: boolean;
  onClose: () => void;
}> = ({ jobId, open, onClose }) => {
  const { data: job, isLoading } = useQuery({
    queryKey: ['translation-job', jobId],
    queryFn: () => getTranslationJobDetail(jobId!),
    enabled: !!jobId && open,
  });

  return (
    <Modal
      title="翻译任务详情"
      open={open}
      onCancel={onClose}
      width={1000}
      footer={null}
    >
      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* 基本信息 */}
          <Descriptions title="基本信息" column={2} bordered>
            <Descriptions.Item label="发起人">
              <Avatar src={job?.user?.avatar} /> {job?.user?.name}
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {job?.provider.name} ({job?.provider.type})
            </Descriptions.Item>
            <Descriptions.Item label="项目">
              {job?.project?.name}
            </Descriptions.Item>
            <Descriptions.Item label="语言">
              {job?.sourceLanguage} → {job?.targetLanguage}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag status={job?.status} />
            </Descriptions.Item>
            <Descriptions.Item label="字符数">
              {job?.characterCount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(job?.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {job?.completedAt
                ? dayjs(job.completedAt).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {/* 翻译明细 */}
          <Title level={5}>翻译结果（{job?.items.length} 个词条）</Title>
          <Table
            dataSource={job?.items}
            rowKey="id"
            pagination={false}
            scroll={{ y: 400 }}
            columns={[
              {
                title: '词条名称',
                dataIndex: 'keyName',
                key: 'keyName',
              },
              {
                title: '原文',
                dataIndex: 'sourceContent',
                key: 'sourceContent',
                ellipsis: true,
              },
              {
                title: '翻译结果',
                dataIndex: 'translatedContent',
                key: 'translatedContent',
                ellipsis: true,
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => <StatusTag status={status} />,
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
};
```

---

## 五、数据清理策略

### 5.1 定期清理任务

**实现方式**: 使用 NestJS 的调度任务

```typescript
// src/translation/translation-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TranslationCleanupService {
  private readonly logger = new Logger(TranslationCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每周日凌晨 2 点清理 2 年前的翻译任务
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldJobs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    this.logger.log(
      `Starting cleanup of translation jobs before ${cutoffDate.toISOString()}`,
    );

    try {
      // 先删除 TranslationJobItem（级联删除会自动处理，但显式删除更安全）
      const itemsResult = await this.prisma.translationJobItem.deleteMany({
        where: {
          Job: {
            createdAt: { lt: cutoffDate },
          },
        },
      });

      // 再删除 TranslationJob
      const jobsResult = await this.prisma.translationJob.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      this.logger.log(
        `Cleanup completed: deleted ${jobsResult.count} jobs and ${itemsResult.count} job items`,
      );
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

### 5.2 模块配置

```typescript
// translation.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TranslationCleanupService } from './translation-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [TranslationCleanupService],
})
export class TranslationModule {}
```

---

## 六、测试计划

### 6.1 后端测试

**单元测试**:
- [ ] `getTranslationJobs` - 测试各种筛选条件
- [ ] `getMonthlyStats` - 测试统计计算逻辑
- [ ] `createTranslationJob` - 测试任务创建和明细关联
- [ ] `executeTranslationJob` - 测试翻译执行和状态更新

**集成测试**:
- [ ] 创建任务 → 查询列表 → 查看详情 → 验证数据一致性
- [ ] 测试级联删除（删除供应商/任务）
- [ ] 测试数据清理任务

### 6.2 前端测试

**组件测试**:
- [ ] `MonthlyStatsSection` - 测试统计卡片渲染
- [ ] `JobFilters` - 测试筛选器功能
- [ ] `JobTable` - 测试表格数据展示
- [ ] `JobDetailModal` - 测试详情弹窗

**E2E 测试**:
- [ ] 筛选任务列表
- [ ] 查看任务详情
- [ ] 验证统计数据准确性

---

## 七、性能优化建议

### 7.1 数据库索引

```sql
-- 确保以下索引存在
CREATE INDEX "TranslationJob_userId_createdAt_idx" ON "TranslationJob"("userId", "createdAt");
CREATE INDEX "TranslationJob_providerId_createdAt_idx" ON "TranslationJob"("providerId", "createdAt");
CREATE INDEX "TranslationJob_status_createdAt_idx" ON "TranslationJob"("status", "createdAt");
CREATE INDEX "TranslationJobItem_jobId_idx" ON "TranslationJobItem"("jobId");
```

### 7.2 查询优化

- 使用 `select` 仅查询需要的字段
- 对大表使用分页查询
- 避免 N+1 查询问题（使用 Prisma 的 `include`）

### 7.3 缓存策略（可选）

```typescript
// 使用 Redis 缓存月度统计（5 分钟 TTL）
@CacheKey('translation:monthly-stats:{year}-{month}')
@CacheTTL(300)
async getMonthlyStats(year: number, month: number) {
  // ...
}
```

---

## 八、并发控制

### 8.1 并发场景

**场景 1：两个人同时翻译同一个词条到同一个语言**
```
用户 A: 翻译词条 "welcome.title" → 英文
用户 B: 翻译词条 "welcome.title" → 英文
时间：同时
```

**问题**：
- 两个任务都会创建 `TranslationJobItemTranslation`
- **唯一约束冲突** (`itemId` + `targetLanguage`)

**场景 2：两个人同时翻译同一个词条到不同语言**
```
用户 A: 翻译词条 "welcome.title" → 英文
用户 B: 翻译词条 "welcome.title" → 日文
时间：同时
```

**无冲突** ✅ - 因为 `targetLanguage` 不同

### 8.2 解决方案

**推荐方案：乐观锁 + 前端防重**

#### 后端：乐观锁策略

**创建任务时检查**：
```typescript
async createTranslationJob(dto: CreateTranslationJobDto, user: User) {
  const items = [];
  
  for (const itemDto of dto.items) {
    // 检查是否已有成功的翻译
    const existing = await this.prisma.translationJobItemTranslation.findFirst({
      where: {
        itemId: itemDto.item.id,
        targetLanguage: { in: dto.targetLanguages },
        status: 'SUCCESS',
      },
    });
    
    if (existing) {
      // 选项 1: 跳过（默认）
      continue;
      
      // 选项 2: 抛出冲突错误
      // throw new ConflictException('翻译已存在');
      
      // 选项 3: 强制覆盖（需要管理员权限）
      // if (!user.isAdmin) {
      //   throw new ConflictException('翻译已存在');
      // }
    }
    
    items.push(itemDto);
  }
  
  // 如果没有可翻译的内容，抛出错误
  if (items.length === 0) {
    throw new BadRequestException('没有可翻译的内容');
  }
  
  // 创建任务...
}
```

**执行翻译时使用 upsert**：
```typescript
// 使用 upsert 避免唯一约束冲突
await this.prisma.translationJobItemTranslation.upsert({
  where: {
    itemId_targetLanguage: {
      itemId: item.id,
      targetLanguage,
    },
  },
  update: {
    translatedContent: translation.translatedText,
    status: translation.error ? 'FAILED' : 'SUCCESS',
    errorMessage: translation.error || null,
    characterCount: translation.translatedText?.length || 0,
  },
  create: {
    itemId: item.id,
    targetLanguage,
    translatedContent: translation.translatedText,
    status: translation.error ? 'FAILED' : 'SUCCESS',
    errorMessage: translation.error || null,
    characterCount: translation.translatedText?.length || 0,
  },
});
```

**策略选择**：
- 如果已有翻译且成功 → **保留先完成的**（upsert 的 update 分支）
- 如果已有翻译但失败 → **覆盖**（允许重试）
- 如果翻译中 → **后完成的覆盖**（乐观锁策略）

#### 前端：防重策略

**检查词条是否正在翻译**：
```typescript
// src/hooks/useKeyTranslationStatus.ts
export const useKeyTranslationStatus = (keyId: string) => {
  return useQuery({
    queryKey: ['key-translating', keyId],
    queryFn: async () => {
      const jobs = await getTranslationJobs({
        status: 'PROCESSING',
        // 检查包含该词条的任务
      });
      return jobs.items.some(job => 
        job.items.some(item => item.keyId === keyId)
      );
    },
    refetchInterval: 2000, // 每 2 秒轮询一次
  });
};
```

**禁用翻译按钮**：
```typescript
// 在翻译按钮组件中
const { data: isTranslating } = useKeyTranslationStatus(key.id);

<Button
  onClick={handleTranslate}
  disabled={isTranslating}
  loading={isTranslating}
>
  {isTranslating ? '翻译中...' : '机器翻译'}
</Button>
```

### 8.3 错误处理

**冲突错误**：
```typescript
// 全局错误处理
if (error instanceof ConflictException) {
  message.warning('该词条已有翻译，如需覆盖请先删除现有翻译');
}

if (error instanceof BadRequestException && 
    error.message === '没有可翻译的内容') {
  message.info('所有词条都已有翻译');
}
```

---

## 九、安全考虑

### 9.1 权限控制

- 仅管理员和翻译角色可以查看任务列表
- 用户只能查看自己发起的任务（非管理员）
- 删除供应商需要管理员权限
- 强制覆盖翻译需要管理员权限

### 9.2 数据脱敏

- 用户头像等敏感信息需要脱敏处理
- API 密钥等敏感信息不在响应中返回

---

## 十、实施计划

### Phase 1: 数据库迁移（1 天）
- [ ] 修改 `schema.prisma`
- [ ] 生成并应用迁移
- [ ] 验证数据完整性

### Phase 2: 后端 API 实现（2 天）
- [ ] 实现 `GET /jobs` 接口
- [ ] 实现 `GET /jobs/:id` 接口
- [ ] 实现 `GET /monthly-stats` 接口
- [ ] 增强 `POST /jobs` 接口
- [ ] 编写单元测试

### Phase 3: 前端页面开发（2 天）
- [ ] 开发 `MonthlyStatsSection` 组件
- [ ] 开发 `JobFilters` 组件
- [ ] 开发 `JobTable` 组件
- [ ] 开发 `JobDetailModal` 组件
- [ ] 集成到 `MachineTranslationSettingsPage`

### Phase 4: 测试与优化（1 天）
- [ ] E2E 测试
- [ ] 性能测试
- [ ] Bug 修复

**总预计**: 6 个工作日

---

## 十一、验收标准

### 功能验收
- [ ] 可以查看本月所有翻译任务列表
- [ ] 支持按发起人、供应商、项目、日期、状态筛选
- [ ] 可以查看任务详情，包括所有翻译词条的原文和结果
- [ ] 可以查看各供应商的本月字符数统计
- [ ] 统计数据准实时更新（延迟 < 5 分钟）

### 性能验收
- [ ] 任务列表查询响应时间 < 500ms
- [ ] 月度统计查询响应时间 < 200ms
- [ ] 支持 10 万 + 任务记录的查询性能

### 数据验收
- [ ] 历史数据迁移成功（如有）
- [ ] 新增任务正确记录发起人
- [ ] 删除供应商时级联删除关联数据
- [ ] 定期清理任务正常运行

---

## 十二、附录

### A. Prisma Schema 完整变更

```prisma
// 完整 schema 变更请参考 2.1 节
```

### B. 相关文件列表

**后端**:
- `apps/backend/src/translation/machine-translation.controller.ts`
- `apps/backend/src/translation/services/machine-translation.service.ts`
- `apps/backend/prisma/schema.prisma`

**前端**:
- `apps/frontend/src/pages/MachineTranslationSettingsPage.tsx`
- `apps/frontend/src/api/machine-translation.ts`
- `apps/frontend/src/components/translation/MonthlyStatsSection.tsx` (新增)
- `apps/frontend/src/components/translation/JobDetailModal.tsx` (新增)

---

**文档版本**: 1.0  
**最后更新**: 2026-03-20  
**审批状态**: 待审批
