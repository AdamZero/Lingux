# Lingux 前端实施计划

**文档版本**: v1.0\
**最后更新**: 2026-03-17\
**执行状态**: 待开始

***

## 目录

1. [概述](#一概述)
2. [关键决策](#二关键决策)
3. [后端依赖](#三后端依赖)
4. [实施阶段](#四实施阶段)
5. [组件架构](#五组件架构)
6. [验收标准](#六验收标准)

***

## 一、概述

### 1.1 目标

基于现有前端实现，进行重构和扩展，建立符合设计规范的模块化前端架构，同时预留增量功能入口。

### 1.2 核心原则

* **渐进式重构**：已有功能迁移优化，增量功能预留

* **模块化设计**：高内聚低耦合，组件可复用

* **权限驱动**：基于角色的动态菜单和功能控制

* **配置化开关**：后端控制功能启用状态

### 1.3 技术栈

| 层级   | 技术                    | 说明   |
| ---- | --------------------- | ---- |
| 框架   | React 18              | 沿用现有 |
| 构建   | Vite                  | 沿用现有 |
| UI 库 | Ant Design 6.x        | 沿用现有 |
| 状态管理 | Zustand + React Query | 沿用现有 |
| 路由   | React Router 6        | 沿用现有 |

***

## 二、关键决策

### 2.1 设计决策汇总

| 决策项           | 方案                      | 说明              |
| ------------- | ----------------------- | --------------- |
| 工作台数据来源       | 后端接口 `/workspace/stats` | 需要后端提供          |
| 审核工作台权限       | 仅 REVIEWER 和 ADMIN 可见   | Sidebar 动态渲染    |
| ComingSoon 交互 | Modal 弹窗提示              | 轻量体验            |
| 功能开关策略        | 后端配置接口                  | 动态控制            |
| 编辑器 Modal 尺寸  | 1000px 宽度               | 左右各 500px       |
| 命名空间切换        | 点击即切换                   | URL query 持久化筛选 |
| 发布历史分页        | 后端分页                    | 与现有风格一致         |
| 项目切换位置        | Header 下拉菜单             | 符合用户习惯          |

### 2.2 接口需求（需后端提供）

```
GET /api/v1/workspace/stats
Response: {
  pending: number,      // 待翻译数量
  reviewing: number,    // 审核中数量
  approved: number      // 已通过数量
}

GET /api/v1/workspace/tasks
Query: {
  status?: 'PENDING' | 'REVIEWING',
  limit?: number
}
Response: {
  items: Task[],
  total: number
}

GET /api/v1/config/features
Response: {
  review: boolean,      // 审核功能开关
  import: boolean,      // 导入功能开关
  invite: boolean       // 邀请功能开关
}
```

***

## 三、后端依赖

### 3.1 已有接口（直接使用）

| 接口                        | 用途     | 状态   |
| ------------------------- | ------ | ---- |
| `GET /keys`               | Key 列表 | ✅ 可用 |
| `POST /keys`              | 创建 Key | ✅ 可用 |
| `PATCH /keys/:id`         | 更新 Key | ✅ 可用 |
| `DELETE /keys/:id`        | 删除 Key | ✅ 可用 |
| `POST /translations`      | 创建翻译   | ✅ 可用 |
| `PATCH /translations/:id` | 更新翻译   | ✅ 可用 |
| `GET /projects`           | 项目列表   | ✅ 可用 |
| `GET /namespaces`         | 命名空间   | ✅ 可用 |
| `GET /releases`           | 发布历史   | ✅ 可用 |
| `POST /releases`          | 创建发布   | ✅ 可用 |

### 3.2 新增接口（需要后端实现）

| 接口                          | 用途     | 优先级 | 阻塞功能               |
| --------------------------- | ------ | --- | ------------------ |
| `GET /workspace/stats`      | 工作台统计  | P0  | DashboardPage 统计卡片 |
| `GET /workspace/tasks`      | 工作台待办  | P0  | DashboardPage 我的待办 |
| `GET /config/features`      | 功能开关   | P1  | ComingSoon 判断      |
| `GET /reviews`              | 审核任务列表 | P1  | ReviewDashboard    |
| `POST /reviews/:id/approve` | 审核通过   | P1  | ReviewDashboard    |
| `POST /reviews/:id/reject`  | 审核退回   | P1  | ReviewDashboard    |

***

## 四、实施阶段

### 4.1 Week 1：框架迁移与组件提取

#### Day 1-2：DashboardPage（工作台）

**任务清单**:

* [ ] 创建 `DashboardPage.tsx`

* [ ] 实现 `StatsCards` 组件（3个统计卡片）

* [ ] 实现 `QuickActions` 组件（3个快捷操作）

* [ ] 实现 `MyTasks` 组件（待办列表）

* [ ] 实现 `RecentActivity` 组件（预留）

* [ ] 配置路由 `/workspace`

**组件设计**:

```typescript
<DashboardPage>
  <StatsCards>
    <StatCard title="待翻译" value={stats.pending} link="/translations?status=PENDING" />
    <StatCard title="审核中" value={stats.reviewing} link="/reviews" />
    <StatCard title="已完成" value={stats.approved} link="/translations?status=APPROVED" />
  </StatsCards>
  
  <QuickActions>
    <ActionButton icon="+" text="新建翻译" onClick={() => navigate('/translations')} />
    <ActionButton icon="📥" text="导入词条" onClick={() => openImportModal()} />
    <ActionButton icon="🚀" text="创建发布" onClick={() => navigate('/releases')} />
  </QuickActions>
  
  <MyTasks>
    <TaskList tasks={tasks} onTaskClick={handleTaskClick} />
  </MyTasks>
  
  <RecentActivity>
    <Empty description="功能开发中，敬请期待" />
  </RecentActivity>
</DashboardPage>
```

**接口调用**:

```typescript
// hooks/useWorkspaceStats.ts
const useWorkspaceStats = () => {
  return useQuery({
    queryKey: ['workspace', 'stats'],
    queryFn: () => apiClient.get('/workspace/stats'),
  });
};

// hooks/useWorkspaceTasks.ts
const useWorkspaceTasks = (params: TaskParams) => {
  return useQuery({
    queryKey: ['workspace', 'tasks', params],
    queryFn: () => apiClient.get('/workspace/tasks', { params }),
  });
};
```

#### Day 3-4：TranslationWorkspace（重构 KeysPage）

**任务清单**:

* [ ] 创建 `ProjectContext` 上下文

* [ ] 提取 `NamespaceSidebar` 组件

* [ ] 提取 `KeyListTable` 组件

* [ ] 提取 `FilterBar` 组件

* [ ] 重构编辑器为 `TranslationEditorModal`

* [ ] 更新路由 `/translations`

**组件设计**:

```typescript
<TranslationWorkspace>
  <ProjectProvider projectId={projectId}>
    <Layout>
      <NamespaceSidebar
        namespaces={namespaces}
        selectedId={selectedNamespace}
        onSelect={handleNamespaceSelect}
      />
      <Content>
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
        />
        <KeyListTable
          keys={keys}
          loading={isLoading}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </Content>
    </Layout>
  </ProjectProvider>
  
  <TranslationEditorModal
    open={!!selectedKey}
    keyId={selectedKey?.id}
    width={1000}
    onClose={() => setSelectedKey(null)}
    onSave={handleSave}
  />
</TranslationWorkspace>
```

**TranslationEditorModal 布局**:

```
┌─────────────────────────────────────────────────────────────┐
│  common.button.submit                              [保存中..]│
│  命名空间: common  |  页面: /checkout  |  标签: button      │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┬───────────────────────┐         │
│  │  原文 (en-US)         │  译文 (zh-CN)         │         │
│  │                       │                       │         │
│  │  Submit               │  ┌─────────────────┐  │         │
│  │                       │  │ 提交            │  │         │
│  │  [📷 查看截图]        │  └─────────────────┘  │         │
│  │                       │                       │         │
│  │  上下文: 结算页按钮    │  状态: 🔴 待翻译      │         │
│  └───────────────────────┴───────────────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  💡 翻译记忆: "Confirm" → "确认" (相似度 85%)               │
├─────────────────────────────────────────────────────────────┤
│  [ 保存草稿 ]    [ 提交审核 → ]                              │
└─────────────────────────────────────────────────────────────┘
```

#### Day 5：公共组件提取

**提取组件清单**:

* [ ] `StatusBadge` - 统一状态徽章

* [ ] `PageHeader` - 页面头部（标题 + 操作按钮）

* [ ] `FilterBar` - 筛选工具栏

* [ ] `ComingSoonModal` - 功能未上线提示

* [ ] `EmptyState` - 空状态（多种类型）

**组件目录**:

```
src/components/
├── common/
│   ├── StatusBadge.tsx
│   ├── PageHeader.tsx
│   ├── FilterBar.tsx
│   ├── ComingSoonModal.tsx
│   └── EmptyState.tsx
├── translation/
│   ├── NamespaceSidebar.tsx
│   ├── KeyListTable.tsx
│   └── TranslationEditorModal.tsx
└── release/
    └── ReleaseHistoryTable.tsx
```

***

### 4.2 Week 2：ReleaseCenter 与权限体系

#### Day 1-2：ReleaseCenter（扩展 PublishDrawer）

**任务清单**:

* [ ] 创建 `ReleaseCenter.tsx`

* [ ] 实现 `CurrentReleaseCard` 组件

* [ ] 实现 `ReleaseHistoryTable` 组件

* [ ] 迁移 `PublishDrawer` 为 `PublishModal`

* [ ] 更新路由 `/releases`

**组件设计**:

```typescript
<ReleaseCenter>
  <PageHeader 
    title="发布中心" 
    extra={<Button type="primary" onClick={() => setPublishOpen(true)}>创建发布</Button>}
  />
  
  <CurrentReleaseCard 
    release={currentRelease}
    onRollback={handleRollback}
  />
  
  <ReleaseHistoryTable
    releases={releases}
    pagination={pagination}
    onPageChange={handlePageChange}
    onViewDetail={handleViewDetail}
  />
  
  <PublishModal
    open={isPublishOpen}
    onClose={() => setPublishOpen(false)}
    onSuccess={handlePublishSuccess}
  />
</ReleaseCenter>
```

#### Day 2-3：权限体系

**任务清单**:

* [ ] 创建 `usePermission` hook

* [ ] 创建 `useFeatures` hook

* [ ] 创建 `RequireRole` 路由守卫组件

* [ ] 更新 Sidebar 动态渲染

**Hook 设计**:

```typescript
// hooks/usePermission.ts
export const usePermission = () => {
  const { user } = useAppStore();
  const { data: features } = useFeatures();
  
  return {
    user,
    features,
    canReview: user?.role === 'REVIEWER' || user?.role === 'ADMIN',
    canPublish: user?.role === 'ADMIN',
    canManageMembers: user?.role === 'ADMIN',
  };
};

// hooks/useFeatures.ts
export const useFeatures = () => {
  return useQuery({
    queryKey: ['config', 'features'],
    queryFn: () => apiClient.get('/config/features'),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
};
```

**Sidebar 动态渲染**:

```typescript
const Sidebar = () => {
  const { canReview, features } = usePermission();
  const location = useLocation();
  
  const items = useMemo(() => {
    const baseItems = [
      { key: '/workspace', icon: <HomeOutlined />, label: '工作台' },
      { key: '/translations', icon: <TranslationOutlined />, label: '翻译管理' },
    ];
    
    if (canReview && features?.review) {
      baseItems.push({
        key: '/reviews',
        icon: <CheckCircleOutlined />,
        label: '审核工作台',
      });
    }
    
    baseItems.push(
      { key: '/releases', icon: <RocketOutlined />, label: '发布中心' },
      { key: '/settings', icon: <SettingOutlined />, label: '项目设置' }
    );
    
    return baseItems;
  }, [canReview, features]);
  
  return <Menu items={items} selectedKeys={[location.pathname]} />;
};
```

#### Day 3-4：ComingSoon 体系与预留功能

**任务清单**:

* [ ] 完善 `ComingSoonModal` 组件

* [ ] 在 DashboardPage 添加导入按钮（预留）

* [ ] 创建 `ReviewDashboard` 占位组件

* [ ] 创建 `MemberManagement` 占位组件

* [ ] 创建 `ImportPreview` 占位组件

**ComingSoonModal 使用**:

```typescript
const DashboardPage = () => {
  const { features } = usePermission();
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  const handleImportClick = () => {
    if (!features?.import) {
      setImportModalOpen(true);
      return;
    }
    navigate('/imports');
  };
  
  return (
    <>
      <QuickActions>
        <ActionButton text="导入词条" onClick={handleImportClick} />
      </QuickActions>
      
      <ComingSoonModal
        open={importModalOpen}
        title="导入功能"
        description="词条导入功能即将上线，支持 JSON/YAML/Excel 格式"
        eta="2026-04-01"
        onClose={() => setImportModalOpen(false)}
      />
    </>
  );
};
```

**ReviewDashboard 占位**:

```typescript
const ReviewDashboard = () => {
  const { canReview } = usePermission();
  
  if (!canReview) {
    return <Navigate to="/workspace" replace />;
  }
  
  // 实际功能待后端接口就绪后实现
  return (
    <PageHeader title="审核工作台" />
    <EmptyState
      type="construction"
      title="功能开发中"
      description="审核工作台正在开发中，敬请期待"
    />
  );
};
```

#### Day 4-5：路由调整与导航优化

**路由配置**:

```typescript
// App.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  
  <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
    {/* 默认跳转工作台 */}
    <Route index element={<Navigate to="/workspace" replace />} />
    
    {/* 工作台 */}
    <Route path="workspace" element={<DashboardPage />} />
    
    {/* 翻译管理 */}
    <Route path="translations" element={<TranslationWorkspace />} />
    
    {/* 审核工作台（权限控制） */}
    <Route 
      path="reviews" 
      element={
        <RequireRole roles={['REVIEWER', 'ADMIN']}>
          <ReviewDashboard />
        </RequireRole>
      } 
    />
    
    {/* 发布中心 */}
    <Route path="releases" element={<ReleaseCenter />} />
    
    {/* 项目设置 */}
    <Route path="settings" element={<ProjectSettings />}>
      <Route index element={<GeneralSettings />} />
      <Route path="members" element={<MemberManagement />} />
    </Route>
  </Route>
  
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

**Header 项目切换**:

```typescript
const Header = () => {
  const { projects, currentProject, switchProject } = useProject();
  
  return (
    <AntHeader>
      <div className="logo">Lingux</div>
      
      <Select
        value={currentProject?.id}
        onChange={switchProject}
        style={{ width: 200 }}
        options={projects.map(p => ({ value: p.id, label: p.name }))}
      />
      
      <Space>
        <NotificationBell />
        <UserMenu />
      </Space>
    </AntHeader>
  );
};
```

***

### 4.3 Week 3：优化与联调

#### Day 1-2：空状态与加载优化

**任务清单**:

* [ ] 实现 `LoadingSkeleton` 组件（列表/卡片/详情）

* [ ] 实现多种 `EmptyState`（无数据/无权限/无网络）

* [ ] 实现 `ErrorBoundary` 错误边界

* [ ] 为所有列表页添加骨架屏

**EmptyState 类型**:

```typescript
type EmptyType = 
  | 'no-data'        // 暂无数据
  | 'no-permission'  // 无权限访问
  | 'no-network'     // 网络异常
  | 'no-result'      // 搜索无结果
  | 'construction';  // 功能开发中

interface EmptyStateProps {
  type: EmptyType;
  title?: string;
  description?: string;
  action?: ReactNode;
}
```

#### Day 2-3：ProjectProvider 与上下文优化

**任务清单**:

* [ ] 完善 `ProjectContext`

* [ ] 在需要的地方包裹 `ProjectProvider`

* [ ] 实现 `useProject` hook

* [ ] 优化项目切换后的数据刷新

**ProjectContext 设计**:

```typescript
interface ProjectContextType {
  project: Project | null;
  namespaces: Namespace[];
  locales: Locale[];
  isLoading: boolean;
  refetch: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ projectId: string }> = ({ 
  projectId, 
  children 
}) => {
  const { data: project, isLoading, refetch } = useProjectDetail(projectId);
  const { data: namespaces } = useNamespaces(projectId);
  const { data: locales } = useProjectLocales(projectId);
  
  return (
    <ProjectContext.Provider value={{
      project,
      namespaces: namespaces || [],
      locales: locales || [],
      isLoading,
      refetch,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
```

#### Day 3-5：接口联调

**联调清单**:

* [ ] `/workspace/stats` - 工作台统计

* [ ] `/workspace/tasks` - 工作台待办

* [ ] `/config/features` - 功能开关

* [ ] 审核相关接口（后续迭代）

***

## 五、组件架构

### 5.1 目录结构（最终）

```
src/
├── components/
│   ├── common/                    # 通用组件
│   │   ├── ComingSoonModal.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FilterBar.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   ├── PageHeader.tsx
│   │   └── StatusBadge.tsx
│   │
│   ├── translation/               # 翻译相关
│   │   ├── KeyListTable.tsx
│   │   ├── NamespaceSidebar.tsx
│   │   ├── TranslationEditorModal.tsx
│   │   └── TranslationStatusBadge.tsx
│   │
│   └── release/                   # 发布相关
│       ├── CurrentReleaseCard.tsx
│       ├── PublishModal.tsx
│       └── ReleaseHistoryTable.tsx
│
├── context/
│   └── ProjectContext.tsx         # 项目上下文
│
├── hooks/
│   ├── useFeatures.ts             # 功能开关
│   ├── usePermission.ts           # 权限判断
│   ├── useProject.ts              # 项目上下文
│   ├── useWorkspaceStats.ts       # 工作台统计
│   └── useWorkspaceTasks.ts       # 工作台待办
│
├── pages/
│   ├── DashboardPage.tsx          # 工作台
│   ├── LoginPage.tsx              # 登录（优化）
│   ├── NotFoundPage.tsx           # 404
│   ├── ProjectPage.tsx            # 项目列表
│   ├── ReleaseCenter.tsx          # 发布中心
│   ├── ReviewDashboard.tsx        # 审核工作台（预留）
│   ├── TranslationWorkspace.tsx   # 翻译工作区
│   └── settings/
│       ├── GeneralSettings.tsx
│       ├── MemberManagement.tsx   # 成员管理（预留）
│       └── ProjectSettings.tsx
│
├── api/
│   ├── client.ts                  # axios 实例
│   ├── config.ts                  # 配置相关
│   ├── keys.ts                    # Key 相关
│   ├── projects.ts                # 项目相关
│   ├── releases.ts                # 发布相关
│   ├── reviews.ts                 # 审核相关（预留）
│   └── workspace.ts               # 工作台相关
│
├── store/
│   └── useAppStore.ts             # 全局状态
│
├── types/
│   ├── key.ts
│   ├── project.ts
│   ├── release.ts
│   ├── review.ts                  # 审核相关（预留）
│   └── workspace.ts               # 工作台相关
│
├── utils/
│   └── permissions.ts             # 权限工具
│
├── App.tsx
├── main.tsx
└── index.css
```

### 5.2 组件依赖关系

```
DashboardPage
├── hooks: useWorkspaceStats, useWorkspaceTasks
├── components: StatCard, QuickActions, TaskList
└── navigates: TranslationWorkspace, ReleaseCenter

TranslationWorkspace
├── context: ProjectProvider
├── hooks: useProject
├── components: NamespaceSidebar, FilterBar, KeyListTable
└── modals: TranslationEditorModal

TranslationEditorModal
├── width: 1000px
├── layout: 左右对照（SourcePanel + TargetPanel）
└── actions: 保存草稿, 提交审核

ReleaseCenter
├── hooks: useReleases
├── components: PageHeader, CurrentReleaseCard, ReleaseHistoryTable
└── modals: PublishModal

ReviewDashboard（预留）
├── guard: RequireRole
├── hooks: usePermission, useFeatures
└── fallback: EmptyState(type: 'construction')
```

***

## 六、验收标准

### 6.1 功能验收

```
□ DashboardPage
  □ 展示3个统计卡片，数据来自 /workspace/stats
  □ 快捷操作按钮可点击，导入按钮显示 ComingSoonModal
  □ 我的待办列表可点击跳转编辑器
  □ 最近动态显示"功能开发中"

□ TranslationWorkspace
  □ 左侧命名空间列表可切换
  □ 右侧 Key 列表展示正确
  □ 筛选条件用 URL query 持久化
  □ 点击 Key 打开 TranslationEditorModal（1000px）
  □ 编辑器左右对照布局符合设计规范

□ ReleaseCenter
  □ 展示当前版本信息
  □ 发布历史列表支持分页
  □ 创建发布按钮打开 PublishModal

□ 权限控制
  □ REVIEWER/ADMIN 可见"审核工作台"菜单
  □ EDITOR 不可见"审核工作台"菜单
  □ 直接访问 /reviews 时无权限则跳转

□ ComingSoon 体系
  □ 功能未开启时点击显示 Modal 提示
  □ Modal 包含标题、描述、预计上线时间
  □ 点击关闭或遮罩可关闭 Modal

□ 导航与路由
  □ Sidebar 菜单与当前路由高亮同步
  □ Header 项目切换器可用
  □ 浏览器刷新后保持登录状态和当前页面
```

### 6.2 性能验收

```
□ 页面首屏加载 < 2s
□ 列表页切换无白屏，有骨架屏过渡
□ 编辑器打开响应 < 300ms
□ 自动保存防抖 500ms，不阻塞输入
```

### 6.3 代码质量验收

```
□ 组件职责单一，符合高内聚低耦合
□ 公共组件可复用，无重复代码
□ TypeScript 类型定义完整
□ 无 any 类型（必要处需注释说明）
□ 错误边界捕获异常，不白屏
```

***

## 附录

### A. 命名规范

| 类型   | 命名规则                 | 示例                       |
| ---- | -------------------- | ------------------------ |
| 组件   | PascalCase           | `TranslationEditorModal` |
| Hook | camelCase，以 use 开头   | `useWorkspaceStats`      |
| 工具函数 | camelCase            | `formatDate`             |
| 常量   | UPPER\_SNAKE\_CASE   | `DEFAULT_PAGE_SIZE`      |
| 类型   | PascalCase + Type 后缀 | `TranslationType`        |

### B. 文件模板

**组件文件模板**:

```typescript
import React from 'react';
import {  } from 'antd';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  // props 定义
}

export const ComponentName: React.FC<ComponentNameProps> = (props) => {
  // 实现
};

export default ComponentName;
```

**Hook 文件模板**:

```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

export const useHookName = (params: ParamsType) => {
  return useQuery({
    queryKey: ['key', params],
    queryFn: () => apiClient.get('/endpoint', { params }),
  });
};
```

***

**文档结束**
