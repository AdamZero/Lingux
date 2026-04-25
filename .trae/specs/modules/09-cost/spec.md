# 成本管控模块规格

**模块编号**: 09-cost  
**模块名称**: 成本管控  
**版本**: v1.0  
**最后更新**: 2026-03-17  
**迭代计划**: 第 4 迭代

---

## 1. 模块概述

### 1.1 功能范围

成本管控模块用于统计和管控 LLM 翻译的成本，帮助企业控制翻译预算。

**功能**：

- LLM 翻译成本统计
- 预算设置与预警
- 用量配额管理
- 成本报表

### 1.2 使用场景

- **成本核算**：了解各项目的翻译成本
- **预算控制**：设置月度预算上限
- **用量限制**：控制单个用户的使用量
- **供应商优化**：对比不同 LLM 供应商的成本

---

## 2. 功能规格

### 2.1 成本数据结构

```typescript
interface TranslationCost {
  id: string;
  projectId: string;
  provider: string; // openai, claude, wenxin, qwen
  model: string; // gpt-4, claude-3, etc.
  operationType: "translate" | "review" | "suggest";

  // 用量统计
  inputTokens: number;
  outputTokens: number;
  characterCount: number;

  // 成本计算
  inputCost: number; // 输入成本
  outputCost: number; // 输出成本
  totalCost: number; // 总成本
  currency: "USD" | "CNY";

  // 关联信息
  translationId?: string;
  keyId?: string;
  userId: string;

  createdAt: Date;
}
```

### 2.2 成本统计维度

| 维度     | 说明                    | 用途           |
| -------- | ----------------------- | -------------- |
| 按项目   | 各项目 LLM 成本         | 项目成本核算   |
| 按语言   | 各语言对成本            | 语言对定价参考 |
| 按供应商 | OpenAI/Claude/文心/通义 | 供应商优化     |
| 按用户   | 各用户用量              | 个人效率分析   |
| 按时间   | 日/周/月趋势            | 预算规划       |

### 2.3 成本报表示例

```
2026年3月 LLM 翻译成本报告
============================

总成本: ¥1,234.56
总字符数: 456,789
总调用次数: 1,234

按供应商分布:
┌─────────────┬──────────┬──────────┐
│ 供应商      │ 成本     │ 占比     │
├─────────────┼──────────┼──────────┤
│ 通义千问    │ ¥567.89  │ 46%      │
│ 文心一言    │ ¥345.67  │ 28%      │
│ OpenAI      │ ¥234.00  │ 19%      │
│ Claude      │ ¥87.00   │ 7%       │
└─────────────┴──────────┴──────────┘

按语言对分布:
┌─────────────┬──────────┬──────────┐
│ 语言对      │ 成本     │ 字符数   │
├─────────────┼──────────┼──────────┤
│ zh-CN→en-US │ ¥456.78  │ 156,789  │
│ zh-CN→ja-JP │ ¥345.67  │ 123,456  │
│ en-US→zh-CN │ ¥234.56  │ 98,765   │
└─────────────┴──────────┴──────────┘

成本趋势 (近30天):
[折线图显示每日成本变化]
```

### 2.4 预算与配额

**预算层级**：
| 层级 | 控制范围 | 超限处理 |
|------|----------|----------|
| 企业级 | 整个企业月度预算 | 暂停所有 LLM 调用 |
| 项目级 | 单个项目月度预算 | 仅暂停该项目 |
| 用户级 | 单个用户月度配额 | 暂停该用户权限 |

**预警机制**：
| 阈值 | 通知方式 | 接收人 |
|------|----------|--------|
| 50% | 站内消息 | 项目管理员 |
| 80% | 邮件+站内 | 项目管理员+企业管理员 |
| 95% | 邮件+短信+站内 | 所有管理员 |
| 100% | 立即暂停 | - |

**配额配置**：

```typescript
interface QuotaConfig {
  // 字符数配额
  maxCharactersPerMonth: number;
  maxCharactersPerDay: number;

  // 调用次数配额
  maxCallsPerMonth: number;
  maxCallsPerDay: number;
  maxCallsPerHour: number;

  // 成本配额
  maxCostPerMonth: number;
  maxCostPerDay: number;

  // 速率限制
  rateLimitPerMinute: number;
  rateLimitPerSecond: number;
}
```

---

## 3. 数据模型

```prisma
model TranslationCost {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  provider  String   // openai, claude, wenxin, qwen
  model     String   // gpt-4, claude-3, etc.
  operationType String // translate, review, suggest

  inputTokens  Int
  outputTokens Int
  characterCount Int

  inputCost  Float
  outputCost Float
  totalCost  Float
  currency   String @default("CNY")

  translationId String?
  keyId         String?
  userId        String

  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
  @@index([userId, createdAt])
}

model BudgetConfig {
  id          String @id @default(cuid())
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  type        String // project, user
  targetId    String? // projectId or userId

  maxCostPerMonth Float
  maxCostPerDay   Float?

  alertThresholds Json // [50, 80, 95]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 4. 接口定义

### 4.1 成本统计接口

#### GET /api/v1/projects/:projectId/costs

**功能**: 获取成本统计  
**权限**: ADMIN  
**查询参数**:

- `startDate`: 开始日期
- `endDate`: 结束日期
- `groupBy`: 分组维度（provider/locale/user）

**响应**:

```json
{
  "code": 200,
  "data": {
    "total": 1234.56,
    "currency": "CNY",
    "byProvider": [{ "provider": "qwen", "cost": 567.89, "percentage": 46 }],
    "byLocale": [{ "locale": "zh-CN→en-US", "cost": 456.78 }]
  }
}
```

### 4.2 预算管理接口

#### GET /api/v1/projects/:projectId/budget

**功能**: 获取预算配置  
**权限**: ADMIN

#### POST /api/v1/projects/:projectId/budget

**功能**: 设置预算  
**权限**: ADMIN  
**请求体**:

```json
{
  "maxCostPerMonth": 5000,
  "maxCostPerDay": 500,
  "alertThresholds": [50, 80, 95]
}
```

---

## 5. 验收标准

- [ ] LLM 调用成本记录
- [ ] 按项目/语言/供应商/用户统计
- [ ] 成本报表生成
- [ ] 预算设置和预警
- [ ] 用量配额管理
- [ ] 超限自动暂停
