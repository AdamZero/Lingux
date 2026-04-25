# Lingux 后端接口需求文档

**文档版本**: v1.0  
**最后更新**: 2026-03-17  
**优先级**: P0 阻塞前端工作台功能

---

## 目录

1. [接口清单](#一接口清单)
2. [工作台接口](#二工作台接口)
3. [配置接口](#三配置接口)
4. [审核接口（预留）](#四审核接口预留)

---

## 一、接口清单

### 1.1 本次需求接口

| 序号 | 接口               | 方法 | 优先级 | 用途           | 阻塞功能               |
| ---- | ------------------ | ---- | ------ | -------------- | ---------------------- |
| 1    | `/workspace/stats` | GET  | P0     | 工作台统计数据 | DashboardPage 统计卡片 |
| 2    | `/workspace/tasks` | GET  | P0     | 工作台待办任务 | DashboardPage 我的待办 |
| 3    | `/config/features` | GET  | P1     | 功能开关配置   | ComingSoon 判断        |

### 1.2 后续迭代接口（供参考）

| 序号 | 接口                   | 方法 | 优先级 | 用途         |
| ---- | ---------------------- | ---- | ------ | ------------ |
| 4    | `/reviews`             | GET  | P1     | 审核任务列表 |
| 5    | `/reviews/:id/approve` | POST | P1     | 审核通过     |
| 6    | `/reviews/:id/reject`  | POST | P1     | 审核退回     |
| 7    | `/imports/preview`     | POST | P1     | 导入预览     |
| 8    | `/imports/:id/confirm` | POST | P1     | 确认导入     |

---

## 二、工作台接口

### 2.1 获取工作台统计

获取当前用户在工作台的统计数据，用于展示统计卡片。

```
GET /api/v1/workspace/stats
```

**请求头**:

```
Authorization: Bearer {token}
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "pending": 42, // 待翻译数量（当前用户有权限且状态为 PENDING 的翻译）
    "reviewing": 15, // 审核中数量（当前用户提交的正在审核的翻译）
    "approved": 128 // 已通过数量（当前用户本月审核通过的翻译）
  }
}
```

**统计规则说明**:

| 字段        | 统计范围                                  | 权限要求                   |
| ----------- | ----------------------------------------- | -------------------------- |
| `pending`   | 当前项目下，状态为 PENDING 的翻译数量     | 用户有 EDIT 权限的命名空间 |
| `reviewing` | 当前用户提交，状态为 REVIEWING 的翻译数量 | 用户自己提交的             |
| `approved`  | 当前用户提交，状态为 APPROVED 的翻译数量  | 本月数据                   |

**错误码**:

| 错误码 | 说明                |
| ------ | ------------------- |
| 401    | 未登录或 token 过期 |
| 403    | 无项目访问权限      |

---

### 2.2 获取工作台待办任务

获取当前用户的待办任务列表，用于工作台"我的待办"展示。

```
GET /api/v1/workspace/tasks
```

**请求头**:

```
Authorization: Bearer {token}
```

**查询参数**:

| 参数        | 类型   | 必填 | 说明                              | 默认值     |
| ----------- | ------ | ---- | --------------------------------- | ---------- |
| `status`    | string | 否   | 筛选状态：`PENDING` / `REVIEWING` | 无（全部） |
| `limit`     | number | 否   | 返回数量限制                      | 10         |
| `projectId` | string | 是   | 当前项目 ID                       | -          |

**响应**:

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "task_001",
        "type": "TRANSLATION", // 任务类型：TRANSLATION / REVIEW
        "title": "翻译 checkout.button.submit",
        "description": "结算页提交按钮",
        "priority": "HIGH", // 优先级：HIGH / MEDIUM / LOW
        "status": "PENDING", // 状态：PENDING / REVIEWING
        "dueDate": "2026-03-20", // 截止日期（可选）
        "key": {
          "id": "key_001",
          "name": "checkout.button.submit",
          "namespace": "common",
          "description": "结算页提交按钮"
        },
        "sourceTranslation": {
          // 原文（baseLocale）
          "id": "trans_001",
          "content": "Submit",
          "locale": "en-US"
        },
        "targetLocale": {
          // 目标语言
          "code": "zh-CN",
          "name": "简体中文"
        },
        "createdAt": "2026-03-17T10:00:00Z",
        "updatedAt": "2026-03-17T10:00:00Z"
      }
    ],
    "total": 42
  }
}
```

**任务类型说明**:

| 类型          | 说明           | 适用角色        |
| ------------- | -------------- | --------------- |
| `TRANSLATION` | 需要翻译的任务 | EDITOR          |
| `REVIEW`      | 需要审核的任务 | REVIEWER, ADMIN |

**排序规则**: 按优先级降序，再按更新时间降序

**错误码**:

| 错误码 | 说明                |
| ------ | ------------------- |
| 400    | 参数错误            |
| 401    | 未登录或 token 过期 |
| 403    | 无项目访问权限      |

---

## 三、配置接口

### 3.1 获取功能开关配置

获取系统功能开关配置，用于前端控制功能展示。

```
GET /api/v1/config/features
```

**请求头**:

```
Authorization: Bearer {token}
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "review": true, // 审核功能开关
    "import": false, // 导入功能开关
    "invite": false, // 邀请功能开关
    "llm": false, // LLM翻译功能开关（预留）
    "tm": false // 翻译记忆功能开关（预留）
  }
}
```

**开关说明**:

| 开关     | 控制功能             | 默认状态 |
| -------- | -------------------- | -------- |
| `review` | 审核工作台菜单和页面 | false    |
| `import` | 导入按钮和功能入口   | false    |
| `invite` | 成员邀请功能         | false    |
| `llm`    | LLM自动翻译          | false    |
| `tm`     | 翻译记忆提示         | false    |

**建议实现方式**:

- 数据库配置表存储开关状态
- 支持按项目维度配置（可选）
- 支持热更新，无需重启服务

**错误码**:

| 错误码 | 说明                |
| ------ | ------------------- |
| 401    | 未登录或 token 过期 |

---

## 四、审核接口（预留）

以下接口为后续迭代预留，本次不需要实现，但建议提前规划数据模型。

### 4.1 获取审核任务列表

```
GET /api/v1/reviews
```

**查询参数**:

| 参数        | 类型   | 必填 | 说明                    |
| ----------- | ------ | ---- | ----------------------- |
| `status`    | string | 否   | `pending` / `completed` |
| `projectId` | string | 是   | 项目 ID                 |
| `page`      | number | 否   | 页码，默认 1            |
| `pageSize`  | number | 否   | 每页数量，默认 20       |

**响应**:

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "review_001",
        "key": {
          "id": "key_001",
          "name": "checkout.button.submit",
          "namespace": "common"
        },
        "translation": {
          "id": "trans_002",
          "content": "提交",
          "locale": "zh-CN"
        },
        "sourceTranslation": {
          "id": "trans_001",
          "content": "Submit",
          "locale": "en-US"
        },
        "submitter": {
          "id": "user_001",
          "name": "张三"
        },
        "submittedAt": "2026-03-17T10:00:00Z",
        "status": "REVIEWING"
      }
    ],
    "total": 100
  }
}
```

### 4.2 审核通过

```
POST /api/v1/reviews/:id/approve
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "id": "review_001",
    "status": "APPROVED",
    "approvedAt": "2026-03-17T12:00:00Z",
    "approver": {
      "id": "user_002",
      "name": "李四"
    }
  }
}
```

### 4.3 审核退回

```
POST /api/v1/reviews/:id/reject
```

**请求体**:

```json
{
  "reason": "占位符不匹配，原文有 {count} 但译文没有",
  "suggestion": "请修改为：共 {count} 件商品"
}
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "id": "review_001",
    "status": "REJECTED",
    "rejectedAt": "2026-03-17T12:00:00Z",
    "rejectReason": "占位符不匹配，原文有 {count} 但译文没有",
    "rejecter": {
      "id": "user_002",
      "name": "李四"
    }
  }
}
```

---

## 附录

### A. 通用响应格式

```json
{
  "code": 0, // 0 表示成功，非 0 表示错误
  "message": "success", // 错误时的提示信息
  "data": {} // 响应数据
}
```

### B. 通用错误码

| 错误码 | 说明                       |
| ------ | -------------------------- |
| 0      | 成功                       |
| 400    | 请求参数错误               |
| 401    | 未认证（token 缺失或过期） |
| 403    | 无权限访问                 |
| 404    | 资源不存在                 |
| 500    | 服务器内部错误             |

### C. 数据模型建议

**Task 模型（供参考）**:

```typescript
interface Task {
  id: string;
  type: "TRANSLATION" | "REVIEW";
  userId: string; // 任务分配给哪个用户
  projectId: string;
  keyId: string;
  translationId?: string; // 已有的翻译 ID（编辑场景）
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

**文档结束**
