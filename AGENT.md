# Lingux - Agent 快速参考

## 项目简介

Lingux 是一个翻译管理系统 (TMS)，帮助团队管理多语言词条和本地化流程。

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design 6 + Zustand + React Query + Vite
- **后端**: NestJS 10 + Prisma + PostgreSQL
- **测试**: Playwright (E2E) + Vitest/Jest (单元测试)

## 目录结构

```
apps/
├── frontend/src/
│   ├── api/          # API 客户端
│   ├── components/   # React 组件
│   ├── hooks/        # 自定义 Hooks
│   ├── pages/        # 页面组件
│   └── store/        # Zustand 状态管理
└── backend/src/
    ├── auth/         # 认证模块
    ├── common/       # 通用工具、拦截器
    ├── project/      # 项目模块
    ├── key/          # 词条模块
    ├── translation/  # 翻译模块
    ├── release/      # 发布模块
    └── prisma/       # 数据库 schema
```

## 常用命令

```bash
# 根目录
pnpm dev          # 同时启动前后端
pnpm build        # 构建
pnpm lint         # 代码检查

# backend 目录
pnpm db:migrate:dev    # 数据库迁移
pnpm db:push           # 应用 schema 变更
pnpm test              # 单元测试

# frontend 目录
pnpm test              # Vitest 单元测试
pnpm test:e2e          # Playwright E2E 测试
```

## 开发规范

### 命名

- 后端文件: `kebab-case.ts` (如 `project.controller.ts`)
- 前端组件: `PascalCase.tsx` (如 `ProjectPage.tsx`)
- 路径别名: `@/` 指向 `src/`

### API 响应格式

```typescript
{
  code: 0,        // 0 = 成功
  message: "success",
  data: { ... }
}
```

### 关键类型（参考 prisma/schema.prisma）

- `TranslationStatus`: PENDING | TRANSLATING | REVIEWING | APPROVED | PUBLISHED
- `UserRole`: ADMIN | EDITOR | REVIEWER
- `KeyType`: TEXT | RICH_TEXT | ASSET

## 设计系统

- **主色调**: #4F46E5 (Indigo)
- **功能色**: Success #10B981 | Warning #F59E0B | Error #EF4444
- **圆角**: 6px (小) / 8px (中)
- 详见 `.impeccable.md`

## 注意事项

1. 提交前运行 `pnpm lint`
2. 后端 API 使用 `TransformInterceptor` 统一包装响应
3. 前端使用 React Query 获取数据，Zustand 管理全局状态
4. 认证使用 JWT，支持飞书/钉钉/企信 OAuth
