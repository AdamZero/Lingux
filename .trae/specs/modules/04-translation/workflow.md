# 翻译工作流模块 - 工作流规格

**模块编号**: 04-translation\
**子模块**: workflow\
**版本**: v1.0\
**最后更新**: 2026-03-17

***

## 1. 状态机设计

### 1.1 状态流转图

```
                    ┌─────────────┐
                    │   PENDING   │◄─────────────────────────────┐
                    │   (待翻译)   │                              │
                    └──────┬──────┘                              │
                           │ 编辑内容                             │
                           ▼                                      │
                    ┌─────────────┐     提交审核                  │
         ┌─────────│ TRANSLATING │────────────────┐              │
         │         │  (翻译中)    │                │              │
         │         └─────────────┘                │              │
         │                                         ▼              │
    机器翻译失败                              ┌─────────────┐     │
         │                                    │  REVIEWING  │     │
         └───────────────────────────────────►│  (审核中)    │     │
                                              └──────┬──────┘     │
                                                     │             │
                            ┌────────────────────────┼────────┐    │
                            │                        │        │    │
                            ▼                        ▼        │    │
                     ┌─────────────┐          ┌─────────────┐ │    │
                     │   APPROVED  │          │   PENDING   │─┘    │
                     │  (已通过)   │          │  (被退回)    │      │
                     └──────┬──────┘          └─────────────┘      │
                            │                                       │
                            │ 发布                                   │
                            ▼                                       │
                     ┌─────────────┐                                │
                     │  PUBLISHED  │────────────────────────────────┘
                     │  (已发布)   │  重新编辑
                     └─────────────┘
```

### 1.2 状态说明

| 状态          | 说明       | 可执行操作        | 操作人      |
| ----------- | -------- | ------------ | -------- |
| PENDING     | 待翻译或待修改  | 编辑、提交审核、机器翻译 | EDITOR   |
| TRANSLATING | 机器翻译进行中  | 取消、等待完成      | SYSTEM   |
| REVIEWING   | 等待审核     | 通过、退回        | REVIEWER |
| APPROVED    | 审核通过，待发布 | 发布、重新编辑      | ADMIN    |
| PUBLISHED   | 已发布      | 重新编辑（创建新版本）  | EDITOR   |

### 1.3 状态流转规则

#### PENDING → REVIEWING

**触发条件**:

- 内容非空
- 内容有变更（与上次审核版本不同）

**操作人**: EDITOR 及以上

**副作用**:

- 记录提交时间
- 通知审核人（根据分配策略）
- 创建审核任务

#### REVIEWING → APPROVED

**触发条件**:

- 审核人有权限（该语言/命名空间的审核权限）

**操作人**: REVIEWER 及以上

**副作用**:

- 记录审核人、审核时间
- 清空退回原因
- 通知译员审核通过

#### REVIEWING → PENDING

**触发条件**:

- 必须填写退回原因（不少于 5 个字符）

**操作人**: REVIEWER 及以上

**副作用**:

- 记录退回原因
- 通知译员被退回
- 译员可在编辑时查看退回原因

#### APPROVED → PUBLISHED

**触发条件**:

- 通过质量门禁检查
- 发布审批通过（如启用发布审批）

**操作人**: ADMIN

**副作用**:

- 生成 Release 版本
- 更新当前版本指针
- 触发 Webhook 通知

#### PUBLISHED → PENDING

**触发条件**:

- 编辑已发布的内容

**操作人**: EDITOR

**副作用**:

- 创建新的翻译版本
- 需要重新走审核流程

***

## 2. 翻译编辑

### 2.1 编辑界面

**功能 ID**: TRANS-EDIT-001\
**功能名称**: 翻译编辑器

#### 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 翻译编辑                                        [保存] [提交审核] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ 原文 ─────────────────────────────────────────────────────┐ │
│ │ Key: common.button.submit                                   │ │
│ │ 命名空间: common                                            │ │
│ │                                                             │ │
│ │ Welcome to our platform!                                    │ │
│ │                                                             │ │
│ │ 上下文: /home 页面，欢迎语                                  │ │
│ │ 截图: [预览图]                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ 译文 ─────────────────────────────────────────────────────┐ │
│ │ 语言: 简体中文 (zh-CN)                                      │ │
│ │                                                             │ │
│ │ [                                            ]              │ │
│ │ [ 欢迎来到我们的平台！                       ]              │ │
│ │ [                                            ]              │ │
│ │                                                             │ │
│ │ 字符数: 12 / 100  ✅                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ 辅助信息 ─────────────────────────────────────────────────┐ │
│ │ 💡 翻译记忆: 92% 匹配 "欢迎来到我们的平台！" [采纳]         │ │
│ │ 📚 术语提示: platform → 平台                               │ │
│ │ 🤖 AI 建议: "欢迎访问我们的平台" [使用]                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ 历史记录 ─────────────────────────────────────────────────┐ │
│ │ 2026-03-17 10:30  张三  提交审核                            │ │
│ │ 2026-03-17 09:15  张三  编辑内容                            │ │
│ │ 2026-03-16 18:20  李四  审核通过                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 功能特性

1. **实时保存**: 自动保存草稿（每 30 秒）
2. **字符计数**: 实时显示字符数，超限警告
3. **语法高亮**: ICU MessageFormat 语法高亮
4. **占位符提示**: 显示源文中的占位符，确保不遗漏
5. **翻译记忆**: 显示相似翻译推荐
6. **术语提示**: 高亮术语并显示标准译法
7. **AI 建议**: 显示机器翻译建议

### 2.2 批量编辑

**功能 ID**: TRANS-EDIT-002\
**功能名称**: 批量翻译编辑

#### 功能描述

支持同时编辑多个 Key 的翻译，提高效率。

#### 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 批量翻译编辑                                    [保存] [取消]   │
├─────────────────────────────────────────────────────────────────┤
│ 已选择 5 个词条                                                 │
│                                                                 │
│ ┌─ 待翻译列表 ───────────────────────────────────────────────┐ │
│ │ □ Key                    │ 原文              │ 译文        │ │
│ │──────────────────────────┼───────────────────┼────────────│ │
│ │ ☑ common.button.submit   │ Submit            │ [提交    ] │ │
│ │ ☑ common.button.cancel   │ Cancel            │ [取消    ] │ │
│ │ ☑ common.button.save     │ Save              │ [保存    ] │ │
│ │ ☑ common.button.delete   │ Delete            │ [删除    ] │ │
│ │ ☑ common.button.edit     │ Edit              │ [编辑    ] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [应用到所有] [一键翻译] [清空]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

***

## 3. 审核流程

### 3.1 审核任务分配

**功能 ID**: TRANS-REVIEW-001\
**功能名称**: 审核任务分配机制

#### 分配策略

1. **按语言分配**
   - 每个语言指定固定审核人
   - 适用于语言专家模式
2. **按命名空间分配**
   - 每个命名空间指定审核人
   - 适用于业务专家模式
3. **自动轮询分配**
   - 在审核人池中轮询分配
   - 负载均衡算法
4. **指定分配**
   - 提交时指定具体审核人
   - 适用于特定审核需求

#### 分配优先级

```
指定审核人 > 命名空间审核人 > 语言审核人 > 轮询分配
```

#### 负载均衡算法

```typescript
function assignReviewer(candidates: User[], pendingCounts: Map<string, number>): User {
  // 1. 过滤在线且未满负荷的审核人
  const available = candidates.filter(u => 
    u.isOnline && pendingCounts.get(u.id) < u.maxWorkload
  );
  
  // 2. 按当前待审任务数升序排序
  available.sort((a, b) => pendingCounts.get(a.id) - pendingCounts.get(b.id));
  
  // 3. 返回任务数最少的审核人
  return available[0];
}
```

### 3.2 审核通知

**功能 ID**: TRANS-REVIEW-002\
**功能名称**: 审核通知机制

#### 通知渠道

| 渠道   | 触发条件    | 延迟    | 内容     |
| ---- | ------- | ----- | ------ |
| 站内消息 | 实时      | 0s    | 待审任务提醒 |
| 企业微信 | 5分钟未处理  | 5min  | 卡片通知   |
| 飞书   | 5分钟未处理  | 5min  | 卡片通知   |
| 钉钉   | 5分钟未处理  | 5min  | 卡片通知   |
| 邮件   | 30分钟未处理 | 30min | 邮件提醒   |

#### 通知卡片内容

```
【翻译审核提醒】
项目：{projectName}
语言：{localeName}
词条：{keyName}
提交人：{submitter}
提交时间：{submitTime}

[查看详情] [通过] [退回]
```

### 3.3 审核界面

**功能 ID**: TRANS-REVIEW-003\
**功能名称**: 审核工作台

#### 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 审核工作台                                      [批量通过] [批量退回]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 筛选: [全部 ▼] [语言: 全部 ▼] [命名空间: 全部 ▼] [提交人: 全部 ▼] │
│                                                                 │
│ ┌─ 待审核列表 ───────────────────────────────────────────────┐ │
│ │ 优先级 │ Key              │ 语言   │ 提交人 │ 提交时间   │ │
│ │────────┼──────────────────┼────────┼────────┼────────────│ │
│ │ 🔴 高  │ common.welcome   │ zh-CN  │ 张三   │ 2分钟前   │ │
│ │ 🟡 中  │ auth.login.title │ en-US  │ 李四   │ 15分钟前  │ │
│ │ 🟢 低  │ home.banner.text │ ja-JP  │ 王五   │ 1小时前   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ 审核详情 ─────────────────────────────────────────────────┐ │
│ │ 原文: Welcome to our platform!                              │ │
│ │ 译文: 欢迎来到我们的平台！                                  │ │
│ │                                                             │ │
│ │ 变更对比:                                                   │ │
│ │ - 欢迎来到我们的平台！                                      │ │
│ │ + 欢迎来到我们的平台！                                      │ │
│ │                                                             │ │
│ │ 质量检查:                                                   │ │
│ │ ✅ ICU 语法正确                                             │ │
│ │ ✅ 占位符匹配                                               │ │
│ │ ⚠️ 术语提示: platform 建议译为"平台"                        │ │
│ │                                                             │ │
│ │ [通过] [退回]                                               │ │
│ │ 退回原因: [____________________]                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

***

## 4. 数据模型

### 4.1 Translation 模型

```prisma
enum TranslationStatus {
  PENDING      // 待翻译
  TRANSLATING  // 翻译中
  REVIEWING    // 审核中
  APPROVED     // 已审核
  PUBLISHED    // 已发布
}

model Translation {
  id             String            @id @default(cuid())
  content        String
  status         TranslationStatus @default(PENDING)
  isLlmTranslated Boolean           @default(false)
  reviewComment  String?           // 退回原因
  
  keyId     String
  key       Key      @relation(fields: [keyId], references: [id])
  localeId  String
  locale    Locale   @relation(fields: [localeId], references: [id])
  
  reviewerId String?
  reviewer   User?    @relation("Reviewer", fields: [reviewerId], references: [id])
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([keyId, localeId])
}
```

### 4.2 ReviewTask 模型

```prisma
model ReviewTask {
  id              String   @id @default(cuid())
  translationId   String
  translation     Translation @relation(fields: [translationId], references: [id])
  
  assigneeId      String?  // 分配的审核人
  assignee        User?    @relation(fields: [assigneeId], references: [id])
  
  status          String   @default("pending") // pending, completed, expired
  assignedAt      DateTime @default(now())
  completedAt     DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

***

## 5. 接口定义

### 5.1 翻译接口

#### GET /api/v1/projects/:projectId/keys/:keyId/translations

**功能**: 获取 Key 的所有翻译\
**响应**:

```json
{
  "code": 200,
  "data": [
    {
      "id": "cuid",
      "content": "欢迎来到我们的平台！",
      "status": "APPROVED",
      "isLlmTranslated": false,
      "locale": {
        "code": "zh-CN",
        "name": "简体中文"
      },
      "reviewer": {
        "id": "cuid",
        "name": "李四"
      },
      "createdAt": "2026-03-17T10:00:00Z",
      "updatedAt": "2026-03-17T10:30:00Z"
    }
  ]
}
```

#### PATCH /api/v1/projects/:projectId/keys/:keyId/translations/:localeCode

**功能**: 更新翻译内容\
**请求体**:

```json
{
  "content": "欢迎来到我们的平台！"
}
```

#### POST /api/v1/projects/:projectId/keys/:keyId/translations/:localeCode/submit

**功能**: 提交审核\
**副作用**: 状态变为 REVIEWING，创建审核任务

#### POST /api/v1/projects/:projectId/keys/:keyId/translations/:localeCode/approve

**功能**: 通过审核\
**权限**: REVIEWER 及以上

#### POST /api/v1/projects/:projectId/keys/:keyId/translations/:localeCode/reject

**功能**: 退回审核\
**请求体**:

```json
{
  "reason": "术语使用不当，platform 应译为"平台""
}
```

***

## 6. 验收标准

- [x] 翻译状态机正确流转
- [ ] 提交审核后状态变为 REVIEWING
- [ ] 审核通过后状态变为 APPROVED
- [ ] 退回审核必须填写原因
- [ ] 审核任务自动分配
- [ ] 审核通知多渠道发送
- [ ] 批量编辑功能
- [ ] 审核工作台界面

