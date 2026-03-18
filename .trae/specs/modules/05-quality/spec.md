# 质量门禁模块规格

**模块编号**: 05-quality  
**模块名称**: 质量门禁  
**版本**: v1.0  
**最后更新**: 2026-03-17

---

## 1. 模块概述

### 1.1 功能范围

本模块负责在发布前对翻译内容进行质量检查，确保发布的翻译符合规范。

**MVP 范围**：

- ICU MessageFormat 语法校验
- 占位符匹配校验

**延后功能**：

- 敏感词拦截
- 术语一致性检查
- 长度限制检查

### 1.2 触发时机

质量门禁在以下时机触发：

1. 发布前自动检查
2. 翻译编辑时实时检查（可选）

---

## 2. 功能规格

### 2.1 ICU 语法校验

**功能 ID**: QUALITY-001  
**功能名称**: ICU MessageFormat 语法检查

#### 功能描述

检查翻译内容中的 ICU MessageFormat 语法是否正确。

#### 校验规则

1. **花括号匹配**
   - 每个 `{` 必须有对应的 `}`
   - 不支持嵌套超过 5 层

2. **必需关键字**
   - `plural` 和 `select` 类型必须包含 `other` 分支

3. **变量名规范**
   - 必须符合 `[a-zA-Z_][a-zA-Z0-9_]*`

#### 支持的 ICU 类型

| 类型     | 示例                                                    | 说明       |
| -------- | ------------------------------------------------------- | ---------- |
| 简单变量 | `{name}`                                                | 直接替换   |
| 数字     | `{count, number}`                                       | 数字格式化 |
| 日期     | `{date, date, short}`                                   | 日期格式化 |
| 复数     | `{count, plural, one {...} other {...}}`                | 复数形式   |
| 选择     | `{gender, select, male {...} female {...} other {...}}` | 性别/选项  |

#### 错误示例

```
✗ 未闭合: "Hello {name"
✗ 缺少 other: "{count, plural, one {1 item}}"
✗ 非法变量名: "{123var}"
✗ 嵌套过深: "{a, select, b {c, select, d {...}}}"
```

### 2.2 占位符校验

**功能 ID**: QUALITY-002  
**功能名称**: 占位符匹配检查

#### 功能描述

检查源文和译文中的占位符是否一致。

#### 支持的占位符类型

| 类型        | 示例                | 说明              |
| ----------- | ------------------- | ----------------- |
| ICU 变量    | `{name}`, `{count}` | ICU MessageFormat |
| printf 风格 | `%s`, `%d`          | C 风格格式化      |
| 双花括号    | `{{variable}}`      | Vue/Mustache 风格 |

#### 校验规则

1. **数量一致**：源文和译文的占位符数量必须相同
2. **类型一致**：占位符类型必须匹配
3. **顺序一致**：建议保持顺序一致（警告级别）

#### 校验示例

```
源文: "Hello {name}, you have {count} messages"
✓ 通过: "你好 {name}, 你有 {count} 条消息"
✗ 失败: "你好，你有 {count} 条消息"  （缺少 {name}）
✗ 失败: "你好 {user}, 你有 {count} 条消息"  （变量名不匹配）
```

### 2.3 门禁报告

**功能 ID**: QUALITY-003  
**功能名称**: 质量门禁报告

#### 功能描述

生成质量检查报告，展示所有问题和统计信息。

#### 报告格式

```json
{
  "passed": false,
  "summary": {
    "total": 150,
    "passed": 145,
    "failed": 5,
    "warnings": 3
  },
  "issues": [
    {
      "keyId": "cuid",
      "keyName": "common.message.count",
      "locale": "zh-CN",
      "severity": "error",
      "rule": "ICU_INVALID",
      "message": "ICU 语法错误：未闭合的花括号",
      "suggestion": "检查 {count 是否有对应的 }"
    }
  ]
}
```

#### 严重程度

| 级别    | 说明       | 处理方式           |
| ------- | ---------- | ------------------ |
| error   | 阻断性问题 | 必须修复才能发布   |
| warning | 警告       | 建议修复，但不阻断 |

---

## 3. 接口定义

### 3.1 质量检查接口

#### POST /api/v1/projects/:projectId/quality/check

**功能**: 执行质量检查  
**权限**: 项目成员  
**请求体**:

```json
{
  "keyIds": ["cuid1", "cuid2"],
  "localeCodes": ["zh-CN", "en-US"]
}
```

**响应**:

```json
{
  "code": 200,
  "data": {
    "passed": false,
    "summary": {
      "total": 10,
      "passed": 8,
      "failed": 2,
      "warnings": 0
    },
    "issues": [...]
  }
}
```

### 3.2 发布前检查接口

#### POST /api/v1/projects/:projectId/releases/preview

**功能**: 发布预览（包含质量检查）  
**权限**: ADMIN  
**响应**: 包含门禁报告的发布预览

---

## 4. 验收标准

- [ ] ICU 花括号匹配校验
- [ ] ICU plural/select 必须包含 other 分支
- [ ] ICU 变量名格式校验
- [ ] 占位符数量一致性校验
- [ ] 占位符类型一致性校验
- [ ] 生成门禁报告
- [ ] 发布前自动触发检查
