# 机器翻译任务详情与统计功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现机器翻译任务详情查看和供应商统计功能，支持多维度筛选和并发控制

**Architecture:** 
- 数据库：新增 `TranslationJobItem` 和 `TranslationJobItemTranslation` 表，修改 `TranslationJob` 支持多语言
- 后端：在 `MachineTranslationController` 新增 3 个 API 接口
- 前端：在 `MachineTranslationSettingsPage` 增加统计卡片和任务列表

**Tech Stack:** NestJS 10, Prisma, PostgreSQL, React 18, Ant Design 6, React Query

---

## Phase 1: 数据库迁移

### Task 1: 修改 Prisma Schema

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:348-370`

- [ ] **Step 1: 修改 TranslationJob 模型**

将现有的 `TranslationJob` 模型修改为支持多语言：

```prisma
// 翻译任务
model TranslationJob {
  id                String            @id @default(cuid())
  providerId        String
  projectId         String?
  userId            String?           // 新增：发起人 ID
  status            TranslationJobStatus @default(PENDING)
  sourceLanguage    String
  targetLanguages   String[]          // 修改：从 targetLanguage 改为数组
  totalKeys         Int               // 新增：总词条数
  translatedKeys    Int @default(0)   // 新增：已翻译词条数
  characterCount    Int
  error             String?
  createdAt         DateTime          @default(now()) @db.Timestamptz
  completedAt       DateTime?         @db.Timestamptz
  
  provider          TranslationProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  user              User?               @relation(fields: [userId], references: [id])
  items             TranslationJobItem[]
  
  @@index([providerId, createdAt])
  @@index([projectId, status])
  @@index([createdAt])
  @@index([userId, createdAt])  // 新增索引
}
```

- [ ] **Step 2: 新增 TranslationJobItem 模型**

在 `TranslationJob` 后添加：

```prisma
// 翻译任务明细（一个词条）
model TranslationJobItem {
  id                String                @id @default(cuid())
  jobId             String
  keyId             String
  keyName           String
  namespaceName     String?
  sourceContent     String
  translations      TranslationJobItemTranslation[]
  createdAt         DateTime              @default(now()) @db.Timestamptz
  
  job               TranslationJob        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  key               Key                   @relation(fields: [keyId], references: [id])
  
  @@index([jobId])
  @@index([keyId])
}
```

- [ ] **Step 3: 新增 TranslationJobItemTranslation 模型**

```prisma
// 翻译任务项的多语言翻译结果
model TranslationJobItemTranslation {
  id                String                @id @default(cuid())
  itemId            String
  targetLanguage    String
  translatedContent String?
  status            TranslationJobItemStatus @default(SUCCESS)
  errorMessage      String?
  characterCount    Int
  createdAt         DateTime              @default(now()) @db.Timestamptz
  
  item              TranslationJobItem    @relation(fields: [itemId], references: [id], onDelete: Cascade)
  
  @@index([itemId])
  @@unique([itemId, targetLanguage])
}

enum TranslationJobItemStatus {
  SUCCESS
  FAILED
  SKIPPED
}
```

- [ ] **Step 4: 修改 User 模型（添加反向关联）**

找到 `User` 模型，添加：

```prisma
model User {
  // ... 现有字段
  translationJobs   TranslationJob[]
}
```

- [ ] **Step 5: 生成迁移文件**

```bash
cd apps/backend
pnpm prisma migrate dev --name add-translation-job-items
```

Expected: 生成迁移文件 `apps/backend/prisma/migrations/<timestamp>_add_translation_job_items/migration.sql`

- [ ] **Step 6: 验证迁移**

```bash
pnpm prisma studio
```

Expected: 看到新的 `TranslationJobItem` 和 `TranslationJobItemTranslation` 表

- [ ] **Step 7: 生成 Prisma 客户端**

```bash
pnpm prisma generate
```

Expected: 输出 "✔ Generated Prisma Client"

- [ ] **Step 8: 提交**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add TranslationJobItem and TranslationJobItemTranslation tables"
```

---

## Phase 2: 后端 API 实现

### Task 2: 实现获取任务列表 API

**Files:**
- Modify: `apps/backend/src/translation/machine-translation.controller.ts`
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts`
- Create: `apps/backend/src/translation/dto/get-translation-jobs.dto.ts`

- [ ] **Step 1: 创建 DTO**

Create `apps/backend/src/translation/dto/get-translation-jobs.dto.ts`:

```typescript
import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { TranslationJobStatus } from '@prisma/client';

export class GetTranslationJobsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(TranslationJobStatus)
  status?: TranslationJobStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
```

- [ ] **Step 2: 实现 Service 方法**

Modify `machine-translation.service.ts`, 添加：

```typescript
async getTranslationJobs(dto: GetTranslationJobsDto) {
  const {
    page = 1,
    pageSize = 20,
    userId,
    providerId,
    projectId,
    status,
    startDate,
    endDate,
  } = dto;

  const where: Prisma.TranslationJobWhereInput = {};

  if (userId) where.userId = userId;
  if (providerId) where.providerId = providerId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  const [items, total] = await Promise.all([
    this.prisma.translationJob.findMany({
      where,
      include: {
        provider: { select: { name: true, type: true } },
        user: { select: { name: true, avatar: true } },
        project: { select: { name: true } },
        items: {
          select: { 
            status: true,
            translations: { select: { status: true } }
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    this.prisma.translationJob.count({ where }),
  ]);

  const formattedItems = items.map((job) => {
    const successCount = job.items.reduce((sum, item) => {
      return sum + item.translations.filter(t => t.status === 'SUCCESS').length;
    }, 0);
    const failedCount = job.items.reduce((sum, item) => {
      return sum + item.translations.filter(t => t.status === 'FAILED').length;
    }, 0);

    return {
      ...job,
      providerName: job.provider.name,
      providerType: job.provider.type,
      userName: job.user?.name || null,
      userAvatar: job.user?.avatar || null,
      projectName: job.project?.name || null,
      totalKeys: job.items.length,
      successCount,
      failedCount,
    };
  });

  return {
    items: formattedItems,
    total,
    page,
    pageSize,
  };
}
```

- [ ] **Step 3: 实现 Controller 方法**

Modify `machine-translation.controller.ts`, 添加：

```typescript
@Get('jobs')
async getTranslationJobs(@Query() dto: GetTranslationJobsDto) {
  return this.machineTranslationService.getTranslationJobs(dto);
}
```

- [ ] **Step 4: 编写单元测试**

Create `apps/backend/src/translation/services/machine-translation.service.spec.ts`:

```typescript
describe('getTranslationJobs', () => {
  it('should return paginated jobs', async () => {
    const mockJobs = [/* mock data */];
    prismaMock.translationJob.findMany.mockResolvedValue(mockJobs);
    prismaMock.translationJob.count.mockResolvedValue(10);

    const result = await service.getTranslationJobs({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(10);
  });
});
```

- [ ] **Step 5: 运行测试**

```bash
cd apps/backend
pnpm test machine-translation.service.spec
```

Expected: All tests pass

- [ ] **Step 6: 提交**

```bash
git add apps/backend/src/translation/
git commit -m "feat(api): implement GET /translation-providers/jobs"
```

---

### Task 3: 实现获取任务详情 API

**Files:**
- Modify: `apps/backend/src/translation/machine-translation.controller.ts`
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts`

- [ ] **Step 1: 实现 Service 方法**

Modify `machine-translation.service.ts`:

```typescript
async getTranslationJobDetail(jobId: string) {
  const job = await this.prisma.translationJob.findUnique({
    where: { id: jobId },
    include: {
      provider: { select: { id: true, name: true, type: true } },
      user: { select: { id: true, name: true, avatar: true } },
      project: { select: { id: true, name: true } },
      items: {
        include: {
          translations: {
            orderBy: { targetLanguage: 'asc' },
          },
        },
        orderBy: { keyName: 'asc' },
      },
    },
  });

  if (!job) {
    throw new NotFoundException(`Translation job ${jobId} not found`);
  }

  return job;
}
```

- [ ] **Step 2: 实现 Controller 方法**

Modify `machine-translation.controller.ts`:

```typescript
@Get('jobs/:id')
async getTranslationJobDetail(@Param('id') id: string) {
  return this.machineTranslationService.getTranslationJobDetail(id);
}
```

- [ ] **Step 3: 编写单元测试**

```typescript
describe('getTranslationJobDetail', () => {
  it('should return job details with items', async () => {
    const mockJob = { /* mock data */ };
    prismaMock.translationJob.findUnique.mockResolvedValue(mockJob);

    const result = await service.getTranslationJobDetail('job-id');

    expect(result.items).toBeDefined();
    expect(result.provider).toBeDefined();
  });

  it('should throw NotFoundException for invalid id', async () => {
    prismaMock.translationJob.findUnique.mockResolvedValue(null);

    await expect(service.getTranslationJobDetail('invalid'))
      .rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
pnpm test machine-translation.service.spec
```

Expected: All tests pass

- [ ] **Step 5: 提交**

```bash
git add apps/backend/src/translation/
git commit -m "feat(api): implement GET /translation-providers/jobs/:id"
```

---

### Task 4: 实现月度统计 API

**Files:**
- Modify: `apps/backend/src/translation/machine-translation.controller.ts`
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts`

- [ ] **Step 1: 实现 Service 方法**

Modify `machine-translation.service.ts`:

```typescript
async getMonthlyStats(year?: number, month?: number) {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0);

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

  const providerIds = stats.map((s) => s.providerId);
  const providers = await this.prisma.translationProvider.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, name: true, type: true },
  });

  const totalCharacters = stats.reduce(
    (sum, s) => sum + (s._sum.characterCount || 0),
    0,
  );
  const totalJobs = stats.reduce((sum, s) => sum + s._count, 0);

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

- [ ] **Step 2: 实现 Controller 方法**

Modify `machine-translation.controller.ts`:

```typescript
@Get('monthly-stats')
async getMonthlyStats(
  @Query('year') year?: number,
  @Query('month') month?: number,
) {
  return this.machineTranslationService.getMonthlyStats(year, month);
}
```

- [ ] **Step 3: 编写单元测试**

```typescript
describe('getMonthlyStats', () => {
  it('should return stats for current month', async () => {
    const mockStats = [/* mock data */];
    prismaMock.translationJob.groupBy.mockResolvedValue(mockStats);
    prismaMock.translationProvider.findMany.mockResolvedValue([]);

    const result = await service.getMonthlyStats();

    expect(result.totalCharacters).toBeDefined();
    expect(result.providers).toBeDefined();
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
pnpm test machine-translation.service.spec
```

Expected: All tests pass

- [ ] **Step 5: 提交**

```bash
git add apps/backend/src/translation/
git commit -m "feat(api): implement GET /translation-providers/monthly-stats"
```

---

### Task 5: 增强创建任务 API（支持并发控制）

**Files:**
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts`
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts:executeTranslationJob`

- [ ] **Step 1: 修改 createTranslationJob 方法**

```typescript
async createTranslationJob(
  dto: CreateTranslationJobDto,
  user: { id: string },
) {
  const { providerId, sourceLanguage, targetLanguages, projectId, items } = dto;

  const effectiveProviderId = providerId || await this.getDefaultProviderId();

  const totalCharacters = items.reduce(
    (sum, item) => sum + item.sourceContent.length,
    0,
  );

  // 并发控制：检查是否已有成功的翻译
  const filteredItems = [];
  for (const item of items) {
    const existing = await this.prisma.translationJobItemTranslation.findFirst({
      where: {
        keyId: item.keyId,
        targetLanguage: { in: targetLanguages },
        status: 'SUCCESS',
      },
    });

    if (!existing) {
      filteredItems.push(item);
    }
  }

  if (filteredItems.length === 0) {
    throw new BadRequestException('没有可翻译的内容');
  }

  const job = await this.prisma.translationJob.create({
    data: {
      providerId: effectiveProviderId,
      projectId,
      userId: user.id,
      status: TranslationJobStatus.PENDING,
      sourceLanguage,
      targetLanguages,
      totalKeys: filteredItems.length,
      translatedKeys: 0,
      characterCount: totalCharacters,
    },
  });

  await this.prisma.translationJobItem.createMany({
    data: filteredItems.map((item) => ({
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

- [ ] **Step 2: 修改 executeTranslationJob 方法**

支持多语言翻译和并发控制：

```typescript
private async executeTranslationJob(jobId: string): Promise<void> {
  const job = await this.prisma.translationJob.findUnique({
    where: { id: jobId },
    include: { items: true },
  });

  if (!job) {
    throw new NotFoundException(`Translation job ${jobId} not found`);
  }

  await this.prisma.translationJob.update({
    where: { id: jobId },
    data: { status: TranslationJobStatus.PROCESSING },
  });

  try {
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const targetLanguage of job.targetLanguages) {
      const texts = job.items.map((item) => item.sourceContent);
      
      const result = await this.translateBatch(job.providerId, texts, {
        sourceLanguage: job.sourceLanguage,
        targetLanguage,
      });

      for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i];
        const translation = result.translations[i];
        
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

        if (translation.error) {
          totalFailed++;
        } else {
          totalSuccess++;
        }
      }

      await this.recordTranslationCost(job.providerId, result.totalCharacters);
    }

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
        translatedKeys: totalSuccess,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: TranslationJobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
  }
}
```

- [ ] **Step 3: 运行测试**

```bash
pnpm test machine-translation.service.spec
```

Expected: All tests pass

- [ ] **Step 4: 提交**

```bash
git add apps/backend/src/translation/
git commit -m "feat(api): enhance createTranslationJob with concurrency control"
```

---

## Phase 3: 前端实现

### Task 6: 创建前端 API 客户端

**Files:**
- Modify: `apps/frontend/src/api/machine-translation.ts`

- [ ] **Step 1: 新增接口定义**

```typescript
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
  targetLanguages: string[];
  totalKeys: number;
  translatedKeys: number;
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
```

- [ ] **Step 2: 新增 API 方法**

```typescript
export const getTranslationJobs = async (
  params?: GetTranslationJobsQuery,
): Promise<TranslationJobListResponse> => {
  return apiClient.get('/translation-providers/jobs', { params });
};

export const getTranslationJobDetail = async (
  jobId: string,
): Promise<TranslationJobDetailResponse> => {
  return apiClient.get(`/translation-providers/jobs/${jobId}`);
};

export const getMonthlyStats = async (
  params?: { year?: number; month?: number },
): Promise<MonthlyStats> => {
  return apiClient.get('/translation-providers/monthly-stats', { params });
};
```

- [ ] **Step 3: 提交**

```bash
git add apps/frontend/src/api/machine-translation.ts
git commit -m "feat(api-client): add translation jobs API methods"
```

---

### Task 7: 创建统计卡片组件

**Files:**
- Create: `apps/frontend/src/components/translation/MonthlyStatsSection.tsx`
- Create: `apps/frontend/src/components/translation/StatCard.tsx`
- Create: `apps/frontend/src/components/translation/ProviderStatCard.tsx`

- [ ] **Step 1: 创建 StatCard 组件**

```typescript
// apps/frontend/src/components/translation/StatCard.tsx
import { Card, Stat, Typography } from 'antd';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 24 }}>{icon}</div>
        <div>
          <Typography.Text type="secondary">{title}</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
        </div>
      </div>
    </Card>
  );
};
```

- [ ] **Step 2: 创建 ProviderStatCard 组件**

```typescript
// apps/frontend/src/components/translation/ProviderStatCard.tsx
import { Card, Progress, Typography } from 'antd';

interface ProviderStatCardProps {
  provider: {
    providerName: string;
    providerType: string;
    characterCount: number;
    jobCount: number;
    percentage: number;
  };
}

export const ProviderStatCard: React.FC<ProviderStatCardProps> = ({ provider }) => {
  return (
    <Card>
      <Typography.Title level={5}>{provider.providerName}</Typography.Title>
      <Typography.Text type="secondary">{provider.providerType}</Typography.Text>
      
      <Progress 
        percent={provider.percentage} 
        format={() => `${provider.percentage}%`}
      />
      
      <div style={{ marginTop: 16 }}>
        <div>字符数：{provider.characterCount.toLocaleString()}</div>
        <div>任务数：{provider.jobCount}</div>
      </div>
    </Card>
  );
};
```

- [ ] **Step 3: 创建 MonthlyStatsSection 组件**

```typescript
// apps/frontend/src/components/translation/MonthlyStatsSection.tsx
import { Card, Row, Col, Divider, Typography, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getMonthlyStats } from '@/api/machine-translation';
import { StatCard } from './StatCard';
import { ProviderStatCard } from './ProviderStatCard';
import { FieldStringOutlined, TaskOutlined, AppstoreOutlined } from '@ant-design/icons';

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

      <Typography.Title level={5}>按供应商统计</Typography.Title>
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

- [ ] **Step 4: 提交**

```bash
git add apps/frontend/src/components/translation/
git commit -m "feat(ui): add MonthlyStatsSection component"
```

---

### Task 8: 创建任务列表组件

**Files:**
- Create: `apps/frontend/src/components/translation/TranslationJobList.tsx`
- Create: `apps/frontend/src/components/translation/JobFilters.tsx`
- Create: `apps/frontend/src/components/translation/JobDetailModal.tsx`

- [ ] **Step 1: 创建 JobFilters 组件**

```typescript
// apps/frontend/src/components/translation/JobFilters.tsx
import { Select, DatePicker, Button, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { getAllUsers } from '@/api/users';
import { getTranslationProviders } from '@/api/machine-translation';
import { getProjects } from '@/api/projects';

const { RangePicker } = DatePicker;

interface JobFiltersProps {
  onFilter: (filters: any) => void;
}

export const JobFilters: React.FC<JobFiltersProps> = ({ onFilter }) => {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: getAllUsers });
  const { data: providers } = useQuery({ 
    queryKey: ['translation-providers'], 
    queryFn: getTranslationProviders 
  });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: getProjects });

  return (
    <Space wrap>
      <Select
        placeholder="发起人"
        allowClear
        style={{ width: 150 }}
        options={users?.map((u) => ({ label: u.name, value: u.id }))}
        onChange={(value) => onFilter({ userId: value })}
      />

      <Select
        placeholder="供应商"
        allowClear
        style={{ width: 150 }}
        options={providers?.map((p) => ({ label: p.name, value: p.id }))}
        onChange={(value) => onFilter({ providerId: value })}
      />

      <Select
        placeholder="项目"
        allowClear
        style={{ width: 150 }}
        options={projects?.map((p) => ({ label: p.name, value: p.id }))}
        onChange={(value) => onFilter({ projectId: value })}
      />

      <RangePicker onChange={(dates) => onFilter({ 
        startDate: dates?.[0]?.toISOString(),
        endDate: dates?.[1]?.toISOString(),
      })} />

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
        onChange={(value) => onFilter({ status: value })}
      />

      <Button type="primary" icon={<SearchOutlined />}>查询</Button>
    </Space>
  );
};
```

- [ ] **Step 2: 创建 JobDetailModal 组件**

```typescript
// apps/frontend/src/components/translation/JobDetailModal.tsx
import { Modal, Descriptions, Table, Divider, Skeleton, Avatar, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getTranslationJobDetail } from '@/api/machine-translation';
import dayjs from 'dayjs';

interface JobDetailModalProps {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ jobId, open, onClose }) => {
  const { data: job, isLoading } = useQuery({
    queryKey: ['translation-job', jobId],
    queryFn: () => getTranslationJobDetail(jobId!),
    enabled: !!jobId && open,
  });

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'default', text: '待处理' },
      PROCESSING: { color: 'processing', text: '处理中' },
      COMPLETED: { color: 'success', text: '已完成' },
      FAILED: { color: 'error', text: '失败' },
      PARTIAL: { color: 'warning', text: '部分失败' },
    };
    const cfg = config[status] || { color: 'default', text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  return (
    <Modal title="翻译任务详情" open={open} onCancel={onClose} width={1000} footer={null}>
      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          <Descriptions title="基本信息" column={2} bordered>
            <Descriptions.Item label="发起人">
              <Avatar src={job?.user?.avatar} /> {job?.user?.name}
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {job?.provider.name} ({job?.provider.type})
            </Descriptions.Item>
            <Descriptions.Item label="项目">{job?.project?.name}</Descriptions.Item>
            <Descriptions.Item label="语言">
              {job?.sourceLanguage} → {job?.targetLanguages.join(', ')}
            </Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(job?.status)}</Descriptions.Item>
            <Descriptions.Item label="字符数">{job?.characterCount.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(job?.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {job?.completedAt ? dayjs(job.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Typography.Title level={5}>翻译结果（{job?.items.length} 个词条）</Typography.Title>
          <Table
            dataSource={job?.items}
            rowKey="id"
            pagination={false}
            scroll={{ y: 400 }}
            columns={[
              { title: '词条名称', dataIndex: 'keyName', key: 'keyName' },
              { title: '命名空间', dataIndex: 'namespaceName', key: 'namespaceName' },
              { title: '原文', dataIndex: 'sourceContent', key: 'sourceContent', ellipsis: true },
              {
                title: '翻译结果',
                dataIndex: 'translations',
                key: 'translations',
                render: (translations: any[]) => (
                  <Space direction="vertical" size="small">
                    {translations.map((t) => (
                      <div key={t.targetLanguage}>
                        <Tag>{t.targetLanguage}</Tag>
                        <Tag color={t.status === 'SUCCESS' ? 'success' : 'error'}>
                          {t.status}
                        </Tag>
                        <span>{t.translatedContent}</span>
                      </div>
                    ))}
                  </Space>
                ),
              },
              {
                title: '状态',
                render: (_, record) => {
                  const allSuccess = record.translations.every((t: any) => t.status === 'SUCCESS');
                  const anyFailed = record.translations.some((t: any) => t.status === 'FAILED');
                  return getStatusTag(allSuccess ? 'COMPLETED' : anyFailed ? 'FAILED' : 'PARTIAL');
                },
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
};
```

- [ ] **Step 3: 提交**

```bash
git add apps/frontend/src/components/translation/
git commit -m "feat(ui): add JobFilters and JobDetailModal components"
```

---

### Task 9: 集成到设置页面

**Files:**
- Modify: `apps/frontend/src/pages/MachineTranslationSettingsPage.tsx`

- [ ] **Step 1: 导入新组件**

```typescript
import { MonthlyStatsSection } from '@/components/translation/MonthlyStatsSection';
import { TranslationJobList } from '@/components/translation/TranslationJobList';
```

- [ ] **Step 2: 添加到页面**

```typescript
<Space direction="vertical" size="large" style={{ width: '100%' }}>
  <MonthlyStatsSection />
  <TranslationJobList />
</Space>
```

- [ ] **Step 3: 运行测试**

```bash
cd apps/frontend
pnpm test
```

Expected: All tests pass

- [ ] **Step 4: 提交**

```bash
git add apps/frontend/src/pages/MachineTranslationSettingsPage.tsx
git commit -m "feat(page): integrate translation analytics into settings page"
```

---

## Phase 4: 测试与优化

### Task 10: E2E 测试

**Files:**
- Create: `apps/frontend/e2e/translation-analytics.spec.ts`

- [ ] **Step 1: 编写 E2E 测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Translation Analytics', () => {
  test('should display monthly stats', async ({ page }) => {
    await page.goto('/settings/machine-translation');
    
    await expect(page.getByText('本月翻译统计')).toBeVisible();
    await expect(page.getByText('总字符数')).toBeVisible();
    await expect(page.getByText('总任务数')).toBeVisible();
  });

  test('should filter jobs by provider', async ({ page }) => {
    await page.goto('/settings/machine-translation');
    
    await page.getByPlaceholder('供应商').click();
    await page.getByText('Google').click();
    
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should show job details', async ({ page }) => {
    await page.goto('/settings/machine-translation');
    
    await page.getByRole('row').first().click();
    
    await expect(page.getByText('翻译任务详情')).toBeVisible();
    await expect(page.getByText('基本信息')).toBeVisible();
  });
});
```

- [ ] **Step 2: 运行 E2E 测试**

```bash
cd apps/frontend
pnpm test:e2e translation-analytics
```

Expected: All E2E tests pass

- [ ] **Step 3: 提交**

```bash
git add apps/frontend/e2e/translation-analytics.spec.ts
git commit -m "test(e2e): add translation analytics E2E tests"
```

---

### Task 11: 性能优化

**Files:**
- Modify: `apps/backend/src/translation/services/machine-translation.service.ts`

- [ ] **Step 1: 添加缓存装饰器**

```typescript
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { UseInterceptors } from '@nestjs/common';

@UseInterceptors(CacheInterceptor)
@CacheKey('translation:monthly-stats:{year}-{month}')
@CacheTTL(300)
async getMonthlyStats(year?: number, month?: number) {
  // ... existing implementation
}
```

- [ ] **Step 2: 添加数据库索引**

```bash
cd apps/backend
pnpm prisma migrate dev --name add-translation-indexes
```

生成迁移：

```sql
CREATE INDEX "TranslationJob_userId_createdAt_idx" ON "TranslationJob"("userId", "createdAt");
CREATE INDEX "TranslationJobItem_jobId_idx" ON "TranslationJobItem"("jobId");
CREATE INDEX "TranslationJobItemTranslation_itemId_idx" ON "TranslationJobItemTranslation"("itemId");
```

- [ ] **Step 3: 提交**

```bash
git add apps/backend/src/ apps/backend/prisma/migrations/
git commit -m "perf: add caching and database indexes for translation analytics"
```

---

### Task 12: 文档更新

**Files:**
- Modify: `README.md`
- Modify: `apps/backend/README.md`

- [ ] **Step 1: 更新功能列表**

在 README.md 中添加：

```markdown
## 新增功能（v1.2.0）

- ✅ 机器翻译任务详情查看
- ✅ 多维度筛选（发起人/供应商/项目/日期/状态）
- ✅ 供应商月度统计
- ✅ 并发控制（乐观锁 + 前端防重）
```

- [ ] **Step 2: 提交**

```bash
git add README.md apps/backend/README.md
git commit -m "docs: update README with translation analytics features"
```

---

## 验收检查清单

- [ ] 数据库迁移成功
- [ ] 所有单元测试通过
- [ ] 所有 E2E 测试通过
- [ ] Lint 检查通过
- [ ] 前端页面正常显示统计数据
- [ ] 筛选功能正常工作
- [ ] 任务详情弹窗正常显示
- [ ] 并发场景下无数据冲突

---

## 预期 Git 提交历史

```
feat(db): add TranslationJobItem and TranslationJobItemTranslation tables
feat(api): implement GET /translation-providers/jobs
feat(api): implement GET /translation-providers/jobs/:id
feat(api): implement GET /translation-providers/monthly-stats
feat(api): enhance createTranslationJob with concurrency control
feat(api-client): add translation jobs API methods
feat(ui): add MonthlyStatsSection component
feat(ui): add JobFilters and JobDetailModal components
feat(page): integrate translation analytics into settings page
test(e2e): add translation analytics E2E tests
perf: add caching and database indexes for translation analytics
docs: update README with translation analytics features
```

---

**Plan 完成。准备进入执行阶段。**
