# 用户与权限模块规格

**模块编号**: 01-auth  
**模块名称**: 用户与权限  
**版本**: v1.0  
**最后更新**: 2026-03-17  

---

## 1. 模块概述

### 1.1 功能范围

本模块负责用户的认证、授权和权限管理，包括：
- OAuth2 第三方登录集成
- JWT 认证机制
- RBAC 权限控制
- 企业组织架构同步

### 1.2 关联模块

| 模块 | 关系 | 说明 |
|------|------|------|
| 02-project | 依赖 | 用户需要登录后才能访问项目 |
| 04-translation | 依赖 | 翻译操作需要权限校验 |
| 06-release | 依赖 | 发布操作需要 ADMIN 权限 |

---

## 2. 认证体系

### 2.1 OAuth2 登录

**功能 ID**: AUTH-001  
**功能名称**: OAuth2 第三方登录

#### 功能描述

支持飞书、钉钉、企业微信 OAuth2 授权登录，实现一键登录体验。

#### 详细规则

1. **首次登录自动创建账号**
   - username 使用平台提供的唯一标识（如飞书的 `open_id`）
   - 自动绑定企业信息（如果 OAuth 返回企业数据）
   - 支持多个 OAuth 账号绑定到同一用户

2. **Token 有效期**
   - Access Token: 2 小时
   - Refresh Token: 7 天

3. **登录流程**
   ```
   用户点击登录 → 跳转 OAuth 授权页 → 用户授权 → 回调获取 code → 
   换取 access_token → 获取用户信息 → 创建/更新本地用户 → 签发 JWT
   ```

#### 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| OAuth 授权失败 | 返回友好错误页面，提示重试 |
| 企业未授权应用 | 提示联系管理员开通应用权限 |
| 获取用户信息失败 | 记录日志，提示稍后重试 |

### 2.2 JWT 认证

**功能 ID**: AUTH-002  
**功能名称**: JWT 无状态认证

#### 功能描述

基于 JWT 实现无状态认证，支持 Token 自动刷新和吊销。

#### 详细规则

1. **Token 内容**
   ```json
   {
     "userId": "cuid",
     "role": "ADMIN",
     "enterpriseId": "cuid",
     "iat": 1700000000,
     "exp": 1700007200
   }
   ```

2. **请求方式**
   ```
   Authorization: Bearer <jwt_token>
   ```

3. **自动刷新**
   - Token 过期前 30 分钟自动刷新
   - 刷新时验证 Token 有效性
   - 吊销列表中的 Token 无法刷新

#### 安全要求

- JWT Secret 定期轮换（建议 90 天）
- 支持 Token 吊销（黑名单机制，Redis 存储）
- Token 过期后必须重新登录

---

## 3. 权限体系

### 3.1 RBAC 权限控制

**功能 ID**: AUTH-003  
**功能名称**: 基于角色的访问控制

#### 角色定义

| 角色 | 标识 | 权限范围 |
|------|------|----------|
| 管理员 | ADMIN | 项目所有操作，成员管理，发布管理 |
| 编辑者 | EDITOR | Key CRUD，翻译编辑，提交审核 |
| 审核员 | REVIEWER | 审核翻译，查看所有内容 |
| 访客 | VIEWER | 只读访问 |

#### 权限粒度

1. **项目级**: 是否可访问项目
2. **命名空间级**: 是否可操作特定命名空间
3. **语言级**: 是否可编辑特定语言

#### 权限判定逻辑

```
1. 检查用户是否有项目访问权限
   └─ 否 → 返回 403
   
2. 检查用户角色是否允许该操作
   └─ 否 → 返回 403
   
3. 检查命名空间权限（如适用）
   └─ 否 → 返回 403
   
4. 检查语言权限（如适用）
   └─ 否 → 返回 403
   
5. 通过 → 执行操作
```

#### 权限配置示例

```typescript
// 项目成员权限配置
interface ProjectMember {
  userId: string;
  role: 'ADMIN' | 'EDITOR' | 'REVIEWER' | 'VIEWER';
  namespacePermissions?: {
    namespaceId: string;
    canEdit: boolean;
  }[];
  localePermissions?: {
    localeCode: string;
    canEdit: boolean;
  }[];
}
```

### 3.2 企业组织架构

**功能 ID**: AUTH-004  
**功能名称**: 企业组织架构同步

#### 功能描述

同步企业组织架构，实现基于部门的权限控制和自动授权。

#### 详细规则

1. **SCIM 2.0 协议支持**
   - 支持标准 SCIM 协议同步用户和部门
   - 支持增量同步和全量同步
   - 支持同步日志和错误处理

2. **平台特定适配**
   - 飞书：通过飞书开放平台 API 同步
   - 钉钉：通过钉钉开放平台 API 同步
   - 企微：通过企业微信 API 同步

3. **部门与项目关联**
   - 部门可以关联到多个项目
   - 部门成员自动获得项目权限
   - 支持跨部门项目协作

4. **自动授权规则**
   ```
   部门管理员 → 项目 ADMIN
   部门成员 → 项目 EDITOR
   可配置映射规则
   ```

---

## 4. 接口定义

### 4.1 认证接口

#### POST /api/v1/auth/login/:provider

**功能**: 发起 OAuth 登录  
**参数**:
- `provider`: 平台标识（feishu/dingtalk/qixin）

**响应**:
```json
{
  "code": 200,
  "data": {
    "oauthUrl": "https://open.feishu.cn/..."
  }
}
```

#### GET /api/v1/auth/callback/:provider

**功能**: OAuth 回调处理  
**参数**:
- `code`: 授权码
- `state`: 状态码（防 CSRF）

**响应**:
```json
{
  "code": 200,
  "data": {
    "token": "jwt_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": "cuid",
      "username": "user_name",
      "role": "ADMIN",
      "enterprise": {
        "id": "cuid",
        "name": "企业名称"
      }
    }
  }
}
```

#### POST /api/v1/auth/refresh

**功能**: 刷新 Token  
**请求头**:
```
Authorization: Bearer <refresh_token>
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "token": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

#### POST /api/v1/auth/logout

**功能**: 退出登录  
**说明**: 将当前 Token 加入吊销列表

### 4.2 用户接口

#### GET /api/v1/users/me

**功能**: 获取当前用户信息  
**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "cuid",
    "username": "user_name",
    "name": "用户姓名",
    "avatar": "https://...",
    "role": "ADMIN",
    "enterprise": {
      "id": "cuid",
      "name": "企业名称"
    },
    "permissions": ["project:create", "key:edit", ...]
  }
}
```

---

## 5. 数据模型

### 5.1 User 模型

```prisma
model User {
  id         String   @id @default(cuid())
  username   String   @unique
  name       String?  // 真实姓名
  email      String?  @unique
  avatar     String?  // 头像 URL
  mobile     String?  // 手机号
  role       UserRole @default(EDITOR)
  externalId String?  @unique // For Feishu/DingTalk
  provider   String?  // 登录来源: feishu, dingtalk, qixin
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  projects     Project[]          @relation("ProjectUsers")
  reviews      Translation[]      @relation("Reviewer")
  auditLogs    AuditLog[]
  enterprises  EnterpriseMember[]
}

enum UserRole {
  ADMIN
  EDITOR
  REVIEWER
  VIEWER
}
```

### 5.2 Enterprise 模型

```prisma
model Enterprise {
  id         String   @id @default(cuid())
  name       String
  domain     String?  @unique
  externalId String?  @unique
  platform   String   // feishu, qixin, dingtalk
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  members    EnterpriseMember[]
}

model EnterpriseMember {
  id           String   @id @default(cuid())
  enterpriseId String
  userId       String
  role         String   @default("member") // admin, member
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  enterprise   Enterprise @relation(fields: [enterpriseId], references: [id], onDelete: Cascade)
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([enterpriseId, userId])
}
```

---

## 6. 安全考虑

### 6.1 密码安全

- 不存储用户密码（OAuth 登录）
- JWT Secret 定期轮换
- Token 吊销机制

### 6.2 传输安全

- 所有接口强制 HTTPS
- OAuth 回调验证 state 参数
- 敏感信息加密传输

### 6.3 审计日志

- 记录所有登录/登出操作
- 记录权限变更操作
- 记录异常访问尝试

---

## 7. 验收标准

- [ ] 支持飞书 OAuth2 登录
- [ ] 支持钉钉 OAuth2 登录
- [ ] 支持企业微信 OAuth2 登录
- [ ] JWT Token 自动刷新
- [ ] Token 吊销机制
- [ ] RBAC 权限控制
- [ ] 企业组织架构同步
- [ ] 登录审计日志
