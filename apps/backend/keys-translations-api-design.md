 # Keys & Translations API 设计思路

本文档阐述 Lingux 平台核心功能——“文案（Keys）与翻译（Translations）”模块的 API 设计思路。

## 核心设计原则

1.  **RESTful 结构**：API 遵循 RESTful 风格，通过资源层级关系来表达操作。文案（Key）是命名空间（Namespace）的子资源，翻译（Translation）是文案（Key）的子资源。
2.  **原子化与批量操作分离**：提供对单个文案和翻译的精细化操作（CRUD），同时为 LLM 翻译等场景设计专门的批量异步接口。
3.  **状态驱动**：翻译流程通过状态（`status`）字段驱动，如 `PENDING` -> `TRANSLATING` -> `REVIEWING` -> `APPROVED` -> `PUBLISHED`。不同角色的用户通过调用 API 来推进状态流转。
4.  **数据聚合**：在获取列表和详情时，会适当聚合关联数据（如获取 Key 的同时返回其所有语言的 Translation），以减少前端请求次数。

## API 端点设计

### 1. 文案（Keys）管理

文案是翻译的基本单元，其 API 嵌套在项目和命名空间下。

**Endpoint**: `/projects/{projectId}/namespaces/{namespaceId}/keys`

#### `GET /`

-   **描述**: 获取指定命名空间下的所有文案列表，并聚合它们的所有翻译。
-   **用途**: 在管理界面中以表格或列表形式展示所有文案及其多语言翻译状态。
-   **查询参数**:
    -   `page`, `limit`: 用于分页。
    -   `search`: 按文案名称（Key Name）进行模糊搜索。
    -   `status`: 按翻译状态过滤（如只看 `PENDING` 的）。
-   **响应体**: 返回一个文案对象数组，每个对象包含其所有语言的翻译条目。

```json
[
  {
    "id": "key-uuid-1",
    "name": "common.button.submit",
    "type": "TEXT",
    "translations": [
      {
        "locale": "zh-CN",
        "content": "提交",
        "status": "PUBLISHED"
      },
      {
        "locale": "en-US",
        "content": "Submit",
        "status": "PUBLISHED"
      },
      {
        "locale": "ja-JP",
        "content": "",
        "status": "PENDING"
      }
    ]
  }
]
```

#### `POST /`

-   **描述**: 在命名空间下创建一个新的文案。
-   **用途**: 开发者或内容管理员添加新的文案字段。
-   **请求体**:
    -   `name` (String, required): 文案的唯一标识，如 `page.home.title`。
    -   `description` (String): 对文案的描述，为翻译人员提供上下文。
    -   `type` (Enum, default: `TEXT`): 文案类型（`TEXT`, `RICH_TEXT`, `ASSET`）。
    -   `translations` (Object): 一个可选的初始化翻译对象，Key 为 locale code，Value 为内容。
-   **响应**: 返回新创建的文案对象。

### 2. 翻译（Translations）管理

翻译是针对单个文案在特定语言下的具体内容。

**Endpoint**: `/projects/{projectId}/namespaces/{namespaceId}/keys/{keyId}/translations/{localeCode}`

#### `PATCH /`

-   **描述**: 更新或创建单个翻译条目。这是最核心的翻译操作接口。
-   **用途**: 编辑、审核或发布某个文案在特定语言下的翻译。
-   **请求体**:
    -   `content` (String): 新的翻译内容。
    -   `status` (Enum): （可选）由审核员或发布流程更新翻译状态。
-   **逻辑**: 
    -   普通编辑只修改 `content`。
    -   审核员可以修改 `content` 和 `status`。
    -   后端根据用户角色判断其是否有权限修改 `status`。

### 3. 批量操作

**Endpoint**: `/projects/{projectId}/translations/batch`

#### `POST /llm-translate`

-   **描述**: 触发 LLM 批量翻译。
-   **用途**: 对项目/命名空间下的多个文案进行自动翻译。
-   **行为**: 这是一个**异步接口**。API 会立即返回 `202 Accepted`，并在后台创建翻译任务。
-   **请求体**:
    -   `sourceLocale` (String, required): 源语言。
    -   `targetLocales` (Array<String>, required): 目标语言数组。
    -   `keyIds` (Array<String>): （可选）需要翻译的文案 ID 列表。如果为空，则翻译整个项目或指定命名空间下的所有待翻译文案。

---

以上是我对核心模块 API 的设计思路。如果您觉得这个方向可行，我将把这些设计更新到 `api-design.json` 文件中。