# API 设计反思与修改建议

针对收到的专业建议清单，我对现有的 API 设计进行了深入反思。清单中的建议质量非常高，以下是我的分析和相应的修改计划。

---

### 1. `translations` 初始化格式

- **问题**: `POST /keys` 时，`translations` 的初始化格式是对象 `{"locale": "content"}`，而响应体中是数组 `[{"locale": "...", "content": "..."}]`，格式不一致。
- **反思**: 完全正确。请求和响应格式保持一致是良好 API 设计的实践，可以减少客户端的处理负担。数组格式也更具扩展性。
- **修改建议**: 将 `POST /keys` 请求体中的 `translations` 字段格式从 **对象** 修改为 **数组**。

### 2. 翻译的 `upsert` 语义

- **问题**: `PATCH` 接口用于 `upsert`，需要明确校验 `locale` 的合法性。
- **反思**: 我的设计中 `PATCH .../translations/{localeCode}` 确实是 `upsert` 语义，这一点是合理的。但清单中提到的“校验 locale 合法性”是至关重要的实现细节，我应该在设计文档中明确指出。后端必须校验 `{localeCode}` 是否存在于全局 `Locale` 表中，并且已经关联到当前项目。
- **修改建议**: 在 API 描述中明确补充“**服务端必须校验 `localeCode` 是否已在项目中启用**”的逻辑。

### 3. 批量翻译缺少反馈

- **问题**: 异步的批量翻译接口没有提供任务追踪机制。
- **反思**: 这是一个重大的设计疏漏。对于任何异步任务，必须提供查询其状态的机制。
- **修改建议**:
  1.  `POST /.../llm-translate` 接口的 `202 Accepted` 响应体中，应返回一个 `taskId`。
  2.  新增一个顶层任务查询接口 `GET /tasks/{taskId}`，用于查询翻译任务的当前状态（如 `pending`, `processing`, `completed`, `failed`）和结果。

### 4. 缺少 Key 详情接口

- **问题**: 只有获取 Key 列表的接口，没有获取单个 Key 详情的接口。
- **反思**: 的确如此。虽然列表接口聚合了翻译信息，但在编辑单个 Key 或查看其详细历史时，一个独立的详情接口是必需的。
- **修改建议**: 新增 `GET /projects/{projectId}/namespaces/{namespaceId}/keys/{keyId}` 接口，用于获取单个文案及其所有翻译的完整信息。

### 5. 状态流转过于隐式

- **问题**: 直接通过 `PATCH` 修改 `status` 字段，状态流转不够明确。
- **反思**: 这是 State-Oriented vs. Action-Oriented 的经典设计抉择。我当前是 State-Oriented，简单直接。但清单建议的 Action-Oriented（如 `POST /.../approve`）意图更明确，更符合领域驱动设计的思想，也便于进行更精细的权限控制和审计。
- **修改建议**: 增加专门的 Action 接口来处理核心的状态流转。例如：
  - `POST .../translations/{translationId}/approve` (审核通过)
  - `POST .../translations/{translationId}/reject` (审核拒绝)
  - 保留 `PATCH` 用于编辑翻译内容本身。

### 6. 错误码不明确

- **问题**: API 设计中没有定义清晰的错误码。
- **反思**: 非常正确。一个完整的 API 设计必须包含错误处理。
- **修改建议**: 在 API 设计文档中增加一个“错误响应”章节，明确通用的 HTTP 状态码含义，如：
  - `400 Bad Request`: 请求体验证失败。
  - `401 Unauthorized`: 未认证。
  - `403 Forbidden`: 无权限操作。
  - `404 Not Found`: 资源不存在。
  - `409 Conflict`: 资源冲突（如创建重名 Key）。

### 7. Namespace 的合理性

- **问题**: 需要确认业务上是否真的需要 `Namespace`，避免过度设计。
- **反思**: 这是一个很好的产品层面的反思。在我们的场景中，`Namespace` 是实现“文案分组”功能的技术载体。对于一个企业级网站，文案数量可能成千上万，如果没有分组（如 `common`, `header`, `product_page`），所有 Key 混在一起将是灾难性的。它能有效避免命名冲突（不同页面都可能有叫 `title` 的 Key），并方便按模块分配翻译任务。
- **结论**: 我认为 `Namespace` 是**必要的设计**，而非过度设计。它是保证项目可扩展性和可维护性的关键一环。我将坚持保留此设计。
