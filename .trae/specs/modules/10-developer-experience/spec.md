# 开发者体验模块规格

**模块编号**: 10-developer-experience  
**模块名称**: 开发者体验（内容消费）  
**版本**: v1.0  
**最后更新**: 2026-03-17  

---

## 1. 模块概述

### 1.1 功能范围

本模块负责将翻译内容交付给开发者使用，提供简单直接的消费方式：
- JSON 文件下载
- CDN 托管访问
- Webhook 通知

### 1.2 设计理念

**简单优先**：
- 不需要复杂的 SDK
- 不需要认证（CDN 链接）
- 开发者只需一个 URL 或文件

---

## 2. 功能规格

### 2.1 JSON 文件下载

**功能 ID**: DEV-001  
**功能名称**: 翻译文件下载

#### 功能描述

开发者可以下载包含所有翻译的 JSON 文件，格式为 i18next 标准格式。

#### 详细规则

1. **文件格式**
   ```json
   {
     "zh-CN": {
       "common": {
         "button": {
           "submit": "提交",
           "cancel": "取消"
         }
       },
       "auth": {
         "login": {
           "title": "登录",
           "username": "用户名"
         }
       }
     },
     "en-US": {
       "common": {
         "button": {
           "submit": "Submit",
           "cancel": "Cancel"
         }
       }
     }
   }
   ```

2. **下载方式**
   - 前端界面：项目设置页提供"下载翻译文件"按钮
   - API 接口：`GET /api/v1/projects/:projectId/translations.json`

3. **文件版本**
   - 文件名包含版本号：`translations-v12.json`
   - 或包含时间戳：`translations-20260317.json`

4. **增量文件（可选）**
   - 只包含自某版本以来的变更
   - 参数：`?since=v11`

### 2.2 CDN 托管

**功能 ID**: DEV-002  
**功能名称**: CDN 托管访问

#### 功能描述

每次发布自动上传到 CDN，开发者通过固定 URL 访问最新翻译。

#### 详细规则

1. **CDN URL 格式**
   ```
   https://cdn.lingux.io/{projectSlug}/{version}/translations.json
   https://cdn.lingux.io/{projectSlug}/latest/translations.json
   ```

2. **版本策略**
   - 固定版本：`.../v12/translations.json`（永不改变）
   - 最新版本：`.../latest/translations.json`（随发布更新）
   - 建议生产环境使用固定版本

3. **缓存策略**
   - 固定版本：永久缓存（Cache-Control: immutable）
   - latest：短时间缓存（Cache-Control: max-age=300）

4. **CORS 配置**
   - 允许所有域名访问
   - 支持预检请求

5. **存储后端**
   - 对象存储：MinIO / AWS S3 / 阿里云 OSS
   - CDN 加速：CloudFlare / 阿里云 CDN

### 2.3 Webhook 通知

**功能 ID**: DEV-003  
**功能名称**: 发布完成通知

#### 功能描述

发布完成后，自动通知开发者的服务端，触发自动更新流程。

#### 详细规则

1. **Webhook 配置**
   ```typescript
   interface WebhookConfig {
     id: string;
     projectId: string;
     url: string;              // 接收通知的 URL
     secret: string;           // 签名密钥
     events: WebhookEvent[];   // 订阅的事件
     isActive: boolean;
   }
   
   enum WebhookEvent {
     RELEASE_PUBLISHED = 'release.published',
     RELEASE_ROLLED_BACK = 'release.rolled_back'
   }
   ```

2. **Webhook  Payload**
   ```json
   {
     "event": "release.published",
     "timestamp": "2026-03-17T10:00:00Z",
     "project": {
       "id": "cuid",
       "name": "My Project",
       "slug": "my-project"
     },
     "release": {
       "id": "cuid",
       "version": 12,
       "cdnUrl": "https://cdn.lingux.io/my-project/v12/translations.json"
     }
   }
   ```

3. **签名验证**
   ```
   X-Lingux-Signature: sha256={hmac_sha256(payload, secret)}
   ```

4. **重试机制**
   - 首次失败：5 秒后重试
   - 第二次失败：30 秒后重试
   - 第三次失败：5 分钟后重试
   - 最多重试 3 次

5. **失败通知**
   - Webhook 连续失败 3 次，发送邮件通知项目管理员

---

## 3. 使用场景示例

### 场景 1：前端项目直接使用 CDN

```javascript
// React 项目
import { useEffect, useState } from 'react';

function useTranslations() {
  const [translations, setTranslations] = useState(null);
  
  useEffect(() => {
    // 使用固定版本，确保稳定性
    fetch('https://cdn.lingux.io/my-project/v12/translations.json')
      .then(res => res.json())
      .then(data => setTranslations(data));
  }, []);
  
  return translations;
}
```

### 场景 2：服务端渲染项目

```javascript
// Next.js 项目
// 构建时下载翻译文件
const translations = require('./translations.json');

// 或使用环境变量指定版本
const CDN_URL = process.env.TRANSLATIONS_CDN_URL;
```

### 场景 3：自动化更新流程

```javascript
// 服务端接收 Webhook
app.post('/webhook/lingux', (req, res) => {
  const { event, release } = req.body;
  
  if (event === 'release.published') {
    // 1. 下载新版本的翻译文件
    download(release.cdnUrl, './translations.json');
    
    // 2. 触发重新部署
    triggerRedeploy();
  }
  
  res.sendStatus(200);
});
```

---

## 4. 数据模型

```prisma
model Webhook {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  url       String
  secret    String
  events    String[] // ['release.published', 'release.rolled_back']
  isActive  Boolean  @default(true)
  
  // 统计
  lastTriggeredAt DateTime?
  lastStatus      String?   // success, failed
  failCount       Int       @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String
}

model WebhookDelivery {
  id        String   @id @default(cuid())
  webhookId String
  webhook   Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  
  event     String
  payload   Json
  responseStatus Int?
  responseBody   String?
  
  createdAt DateTime @default(now())
}
```

---

## 5. 接口定义

### 5.1 翻译文件接口

#### GET /api/v1/projects/:projectId/translations.json

**功能**: 下载翻译文件  
**权限**: 项目成员  
**查询参数**:
- `version`: 指定版本，默认最新
- `format`: 格式（json/yaml），默认 json
- `namespaces`: 指定命名空间，逗号分隔

**响应**: 文件流（Content-Type: application/json）

### 5.2 Webhook 管理接口

#### GET /api/v1/projects/:projectId/webhooks

**功能**: 获取 Webhook 列表  
**权限**: ADMIN

#### POST /api/v1/projects/:projectId/webhooks

**功能**: 创建 Webhook  
**权限**: ADMIN  
**请求体**:
```json
{
  "url": "https://example.com/webhook",
  "events": ["release.published"],
  "secret": "your-secret-key"
}
```

#### POST /api/v1/projects/:projectId/webhooks/:id/test

**功能**: 测试 Webhook  
**权限**: ADMIN  
**说明**: 发送测试事件到配置的 URL

---

## 6. 验收标准

- [ ] 可以通过 CDN URL 访问翻译文件
- [ ] 固定版本 URL 内容不变
- [ ] latest URL 随发布自动更新
- [ ] 支持 CORS 跨域访问
- [ ] Webhook 在发布完成后触发
- [ ] Webhook 支持签名验证
- [ ] Webhook 失败时自动重试
- [ ] 可以下载指定版本的翻译文件
