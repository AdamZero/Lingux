# OAuth2 集成配置指南

本指南将帮助您在飞书、企信和钉钉平台上配置 OAuth2 应用，以便使用这些平台进行身份验证。

## 1. 飞书 (Feishu)

### 1.1 配置步骤

1. **登录飞书开发者平台**：访问 [飞书开放平台](https://open.feishu.cn/)
2. **创建企业自建应用**：
   - 进入「开发者后台」
   - 点击「创建企业自建应用」
   - 填写应用名称、描述等信息
3. **配置应用权限**：
   - 在「权限管理」中，添加「获取用户信息」权限
4. **设置回调地址**：
   - 在「安全设置」中，添加回调地址：`http://localhost:3001/auth/feishu/callback`
5. **获取应用凭证**：
   - 在「凭证与基础信息」中，获取 `App ID` 和 `App Secret`

### 1.2 环境变量配置

在 `apps/backend/.env` 文件中配置以下环境变量：

```env
# Feishu OAuth2 Configuration
FEISHU_CLIENT_ID=your-feishu-client-id
FEISHU_CLIENT_SECRET=your-feishu-client-secret
FEISHU_CALLBACK_URL=http://localhost:3001/auth/feishu/callback
```

## 2. 企信 (Qixin)

### 2.1 配置步骤

1. **登录企信开放平台**：访问 [企信开放平台](https://open.qixin.com/)
2. **创建应用**：
   - 进入「开发者中心」
   - 点击「创建应用」
   - 填写应用名称、描述等信息
3. **配置应用权限**：
   - 在「权限管理」中，添加「用户信息」相关权限
4. **设置回调地址**：
   - 在「应用设置」中，添加回调地址：`http://localhost:3001/auth/qixin/callback`
5. **获取应用凭证**：
   - 在「应用详情」中，获取 `Client ID` 和 `Client Secret`

### 2.2 环境变量配置

在 `apps/backend/.env` 文件中配置以下环境变量：

```env
# Qixin OAuth2 Configuration
QIXIN_CLIENT_ID=your-qixin-client-id
QIXIN_CLIENT_SECRET=your-qixin-client-secret
QIXIN_CALLBACK_URL=http://localhost:3001/auth/qixin/callback
```

## 3. 钉钉 (DingTalk)

### 3.1 配置步骤

1. **登录钉钉开放平台**：访问 [钉钉开放平台](https://open.dingtalk.com/)
2. **创建企业内部应用**：
   - 进入「开发者后台」
   - 点击「创建企业内部应用」
   - 填写应用名称、描述等信息
3. **配置应用权限**：
   - 在「权限管理」中，添加「用户信息」相关权限
4. **设置回调地址**：
   - 在「开发管理」中，添加回调地址：`http://localhost:3001/auth/dingtalk/callback`
5. **获取应用凭证**：
   - 在「基础信息」中，获取 `AppKey` 和 `AppSecret`

### 3.2 环境变量配置

在 `apps/backend/.env` 文件中配置以下环境变量：

```env
# DingTalk OAuth2 Configuration
DINGTALK_CLIENT_ID=your-dingtalk-client-id
DINGTALK_CLIENT_SECRET=your-dingtalk-client-secret
DINGTALK_CALLBACK_URL=http://localhost:3001/auth/dingtalk/callback
```

## 4. 部署环境配置

在生产环境中，您需要：

1. **更新回调地址**：将回调地址中的 `localhost:3001` 替换为您的实际服务器地址
2. **设置安全的 JWT 密钥**：更新 `JWT_SECRET` 为强随机字符串
3. **使用 HTTPS**：在生产环境中，确保使用 HTTPS 协议

## 5. 故障排除

### 5.1 常见问题

1. **回调地址不匹配**：确保平台上配置的回调地址与环境变量中的 `*_CALLBACK_URL` 完全一致
2. **权限不足**：确保已在平台上为应用添加了必要的用户信息权限
3. **网络连接问题**：确保服务器能够访问各平台的 API 地址

### 5.2 日志查看

如需查看详细的认证日志，可以查看后端服务的控制台输出，其中包含了 OAuth2 流程的详细信息。

## 6. 安全注意事项

1. **保护应用凭证**：不要将 `Client ID` 和 `Client Secret` 硬编码在代码中，应使用环境变量
2. **使用 HTTPS**：在生产环境中，确保所有通信都使用 HTTPS
3. **定期轮换密钥**：定期更新应用凭证，特别是在人员变动后
4. **限制权限范围**：只请求必要的权限，避免过度授权

## 7. 集成测试

配置完成后，您可以：

1. **启动后端服务**：`pnpm run dev` in `apps/backend`
2. **启动前端服务**：`pnpm run dev` in `apps/frontend`
3. **访问登录页面**：打开 `http://localhost:3000/login`
4. **测试各平台登录**：点击对应平台的登录按钮，验证整个认证流程

---

通过以上配置，您的 Lingux 项目将能够使用飞书、企信和钉钉进行 OAuth2 身份验证，无需实现本地注册功能。