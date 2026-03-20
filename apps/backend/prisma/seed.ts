import dotenv from 'dotenv';
import path from 'path';
import {
  PrismaClient,
  UserRole,
  TranslationStatus,
  TranslationPriority,
  KeyType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({
  path: path.join(__dirname, '..', '.env'),
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// 测试数据生成辅助函数
const generateCuid = () => {
  // 简化的 CUID 生成
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
};

// 模拟翻译内容
const TRANSLATION_TEMPLATES = {
  'zh-CN': {
    greetings: ['你好', '欢迎', '您好', '早上好', '下午好'],
    actions: ['保存', '提交', '取消', '删除', '编辑', '创建', '更新'],
    messages: [
      '操作成功',
      '操作失败',
      '请稍后重试',
      '数据已保存',
      '确认删除吗？',
    ],
    labels: ['用户名', '密码', '邮箱', '手机号', '地址', '名称', '描述'],
  },
  'en-US': {
    greetings: ['Hello', 'Welcome', 'Hi', 'Good morning', 'Good afternoon'],
    actions: ['Save', 'Submit', 'Cancel', 'Delete', 'Edit', 'Create', 'Update'],
    messages: [
      'Success',
      'Failed',
      'Please try again later',
      'Data saved',
      'Confirm delete?',
    ],
    labels: [
      'Username',
      'Password',
      'Email',
      'Phone',
      'Address',
      'Name',
      'Description',
    ],
  },
  'ja-JP': {
    greetings: ['こんにちは', 'ようこそ', 'おはよう', 'こんばんは'],
    actions: ['保存', '送信', 'キャンセル', '削除', '編集', '作成', '更新'],
    messages: [
      '成功しました',
      '失敗しました',
      '後でもう一度お試しください',
      'データが保存されました',
      '削除してもよろしいですか？',
    ],
    labels: [
      'ユーザー名',
      'パスワード',
      'メール',
      '電話番号',
      '住所',
      '名前',
      '説明',
    ],
  },
};

// 生成随机翻译内容
const generateTranslationContent = (
  localeCode: string,
  key: string,
): string => {
  const templates =
    TRANSLATION_TEMPLATES[localeCode as keyof typeof TRANSLATION_TEMPLATES] ||
    TRANSLATION_TEMPLATES['en-US'];
  const category = Object.keys(templates)[
    Math.floor(Math.random() * Object.keys(templates).length)
  ] as keyof typeof templates;
  const items = templates[category];
  const randomItem = items[Math.floor(Math.random() * items.length)];
  return randomItem || key;
};

const defaultLocales = [
  { code: 'zh-CN', name: '简体中文 (Simplified Chinese)' },
  { code: 'en-US', name: 'English (United States)' },
  { code: 'ja-JP', name: '日本語 (Japanese)' },
  { code: 'ko-KR', name: '한국어 (Korean)' },
  { code: 'zh-TW', name: '繁體中文 (Traditional Chinese)' },
  { code: 'fr-FR', name: 'Français (French)' },
  { code: 'de-DE', name: 'Deutsch (German)' },
  { code: 'es-ES', name: 'Español (Spanish)' },
  { code: 'ru-RU', name: 'Русский (Russian)' },
  { code: 'pt-BR', name: 'Português (Portuguese - Brazil)' },
];

async function main() {
  console.log('Start seeding default locales...');

  for (const locale of defaultLocales) {
    const existing = await prisma.locale.findUnique({
      where: { code: locale.code },
    });

    if (!existing) {
      await prisma.locale.create({
        data: locale,
      });
      console.log(`Created locale: ${locale.name} (${locale.code})`);
    } else {
      console.log(`Locale already exists: ${locale.name} (${locale.code})`);
    }
  }

  const existingSystemUser = await prisma.user.findUnique({
    where: { username: 'system' },
    select: { id: true },
  });
  if (!existingSystemUser) {
    await prisma.user.create({
      data: { username: 'system', role: 'ADMIN' },
    });
    console.log('Created system user');
  } else {
    console.log('System user already exists');
  }

  await seedFeatureFlags();
  await seedEnterpriseAccounts();
  await seedTestData();

  console.log('Seeding finished.');
}

async function seedFeatureFlags() {
  console.log('Start seeding feature flags...');

  const featureFlags = [
    {
      key: 'feature.review',
      value: { enabled: false },
      description: '审核工作台菜单和页面',
    },
    {
      key: 'feature.import',
      value: { enabled: false },
      description: '导入按钮和功能入口',
    },
    {
      key: 'feature.invite',
      value: { enabled: false },
      description: '成员邀请功能',
    },
    {
      key: 'feature.llm',
      value: { enabled: false },
      description: 'LLM 自动翻译',
    },
    {
      key: 'feature.tm',
      value: { enabled: false },
      description: '翻译记忆提示',
    },
  ];

  for (const flag of featureFlags) {
    const existing = await prisma.config.findUnique({
      where: { key: flag.key },
    });

    if (!existing) {
      await prisma.config.create({
        data: flag,
      });
      console.log(`Created feature flag: ${flag.key}`);
    } else {
      console.log(`Feature flag already exists: ${flag.key}`);
    }
  }

  console.log('Feature flags seeding finished.');
}

async function seedEnterpriseAccounts() {
  console.log('Start seeding enterprise accounts for development...');

  const enterprises = [
    {
      name: '演示企业',
      domain: 'demo.example.com',
      externalId: 'demo_corp_001',
      platform: 'feishu',
    },
    {
      name: '测试企业',
      domain: 'test.example.com',
      externalId: 'test_corp_001',
      platform: 'dingtalk',
    },
  ];

  const enterpriseUsers = [
    {
      username: 'admin@demo',
      name: '演示管理员',
      email: 'admin@demo.example.com',
      role: UserRole.ADMIN,
      externalId: 'demo_admin_001',
      provider: 'feishu',
      enterpriseRole: 'admin',
    },
    {
      username: 'editor@demo',
      name: '演示编辑',
      email: 'editor@demo.example.com',
      role: UserRole.EDITOR,
      externalId: 'demo_editor_001',
      provider: 'feishu',
      enterpriseRole: 'member',
    },
    {
      username: 'reviewer@demo',
      name: '演示审核员',
      email: 'reviewer@demo.example.com',
      role: UserRole.REVIEWER,
      externalId: 'demo_reviewer_001',
      provider: 'feishu',
      enterpriseRole: 'member',
    },
    {
      username: 'admin@test',
      name: '测试管理员',
      email: 'admin@test.example.com',
      role: UserRole.ADMIN,
      externalId: 'test_admin_001',
      provider: 'dingtalk',
      enterpriseRole: 'admin',
    },
    {
      username: 'editor@test',
      name: '测试编辑',
      email: 'editor@test.example.com',
      role: UserRole.EDITOR,
      externalId: 'test_editor_001',
      provider: 'dingtalk',
      enterpriseRole: 'member',
    },
  ];

  for (const enterpriseData of enterprises) {
    const existingEnterprise = await prisma.enterprise.findUnique({
      where: { externalId: enterpriseData.externalId },
    });

    let enterprise;
    if (!existingEnterprise) {
      enterprise = await prisma.enterprise.create({
        data: enterpriseData,
      });
      console.log(
        `Created enterprise: ${enterprise.name} (${enterprise.platform})`,
      );
    } else {
      enterprise = existingEnterprise;
      console.log(`Enterprise already exists: ${enterprise.name}`);
    }

    const enterpriseUsersForThisEnterprise = enterpriseUsers.filter(
      (u) => u.provider === enterprise.platform,
    );

    for (const userData of enterpriseUsersForThisEnterprise) {
      const { enterpriseRole, ...userCreateData } = userData;

      let user = await prisma.user.findUnique({
        where: { username: userData.username },
      });

      if (!user) {
        user = await prisma.user.create({
          data: userCreateData,
        });
        console.log(`  Created user: ${user.name} (${user.role})`);
      } else {
        console.log(`  User already exists: ${user.name}`);
      }

      const existingMember = await prisma.enterpriseMember.findUnique({
        where: {
          enterpriseId_userId: {
            enterpriseId: enterprise.id,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        await prisma.enterpriseMember.create({
          data: {
            enterpriseId: enterprise.id,
            userId: user.id,
            role: enterpriseRole,
          },
        });
        console.log(`    Added to enterprise as ${enterpriseRole}`);
      } else {
        console.log(`    Already a member of enterprise`);
      }
    }
  }

  console.log('Enterprise accounts seeding finished.');
  console.log('');
  console.log('=== 开发环境快捷登录信息 ===');
  console.log('演示企业 (飞书):');
  console.log('  管理员: admin@demo / 演示管理员');
  console.log('  编辑:   editor@demo / 演示编辑');
  console.log('  审核员: reviewer@demo / 演示审核员');
  console.log('');
  console.log('测试企业 (钉钉):');
  console.log('  管理员: admin@test / 测试管理员');
  console.log('  编辑:   editor@test / 测试编辑');
  console.log('==========================');
}

async function seedTestData() {
  console.log('');
  console.log('Start seeding test data...');

  // 获取测试用户
  const demoUsers = await prisma.user.findMany({
    where: {
      username: { in: ['admin@demo', 'editor@demo', 'reviewer@demo'] },
    },
  });

  if (demoUsers.length === 0) {
    console.log('No demo users found, skipping test data generation');
    return;
  }

  const adminUser = demoUsers.find((u) => u.username === 'admin@demo');
  const editorUser = demoUsers.find((u) => u.username === 'editor@demo');
  const reviewerUser = demoUsers.find((u) => u.username === 'reviewer@demo');

  if (!adminUser) {
    console.log('Admin user not found, skipping test data generation');
    return;
  }

  // 创建测试项目
  const projects = await createTestProjects(adminUser.id, editorUser?.id);

  // 为每个项目创建测试数据
  for (const project of projects) {
    await createProjectTestData(
      project,
      adminUser.id,
      editorUser?.id,
      reviewerUser?.id,
    );
  }

  console.log('Test data seeding finished.');
}

async function createTestProjects(adminUserId: string, editorUserId?: string) {
  const projectDefinitions = [
    {
      name: '电商APP',
      description: '电商平台移动应用，包含商品展示、购物车、订单管理等功能模块',
      baseLocale: 'zh-CN',
      targetLocales: ['en-US', 'ja-JP', 'ko-KR'],
    },
    {
      name: '企业官网',
      description: '公司官方网站，展示公司信息、产品服务、新闻动态等内容',
      baseLocale: 'zh-CN',
      targetLocales: ['en-US', 'zh-TW'],
    },
    {
      name: '管理后台',
      description: '内部管理系统，包含用户管理、数据统计、系统配置等功能',
      baseLocale: 'zh-CN',
      targetLocales: ['en-US'],
    },
  ];

  const createdProjects: Array<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    baseLocale: string;
    currentReleaseId: string | null;
  }> = [];

  for (const def of projectDefinitions) {
    // 检查项目是否已存在
    const existing = await prisma.project.findFirst({
      where: { name: def.name },
    });

    if (existing) {
      console.log(`  Project already exists: ${def.name}`);
      createdProjects.push(existing);
      continue;
    }

    // 创建项目
    const project = await prisma.project.create({
      data: {
        name: def.name,
        description: def.description,
        baseLocale: def.baseLocale,
        users: {
          connect: editorUserId
            ? [{ id: adminUserId }, { id: editorUserId }]
            : [{ id: adminUserId }],
        },
      },
    });

    console.log(`  Created project: ${project.name}`);

    // 关联语言
    for (const localeCode of [def.baseLocale, ...def.targetLocales]) {
      const locale = await prisma.locale.findUnique({
        where: { code: localeCode },
      });

      if (locale) {
        await prisma.projectLocale.create({
          data: {
            projectId: project.id,
            localeId: locale.id,
            enabled: true,
          },
        });
      }
    }

    createdProjects.push(project);
  }

  return createdProjects;
}

async function createProjectTestData(
  project: { id: string; name: string; baseLocale: string },
  adminUserId: string,
  editorUserId?: string,
  reviewerUserId?: string,
) {
  console.log(`  Creating test data for project: ${project.name}`);

  // 获取项目支持的语言
  const projectLocales = await prisma.projectLocale.findMany({
    where: { projectId: project.id },
    include: { locale: true },
  });

  const localeIds = projectLocales.map((pl) => pl.locale.id);
  const baseLocaleId = projectLocales.find(
    (pl) => pl.locale.code === project.baseLocale,
  )?.locale.id;

  if (!baseLocaleId) {
    console.log(`    Base locale not found for project: ${project.name}`);
    return;
  }

  // 创建命名空间和键
  const namespaces = [
    { name: 'common', description: '通用翻译' },
    { name: 'auth', description: '认证相关' },
    { name: 'user', description: '用户模块' },
    { name: 'product', description: '商品模块' },
    { name: 'order', description: '订单模块' },
  ];

  for (const nsDef of namespaces) {
    let namespace = await prisma.namespace.findUnique({
      where: {
        projectId_name: {
          projectId: project.id,
          name: nsDef.name,
        },
      },
    });

    if (!namespace) {
      namespace = await prisma.namespace.create({
        data: {
          name: nsDef.name,
          description: nsDef.description,
          projectId: project.id,
        },
      });
      console.log(`    Created namespace: ${namespace.name}`);
    }

    // 为每个命名空间创建键和翻译
    const keys = generateKeysForNamespace(nsDef.name);

    for (const keyDef of keys) {
      let key = await prisma.key.findUnique({
        where: {
          namespaceId_name: {
            namespaceId: namespace.id,
            name: keyDef.name,
          },
        },
      });

      if (!key) {
        key = await prisma.key.create({
          data: {
            name: keyDef.name,
            description: keyDef.description,
            type: keyDef.type || KeyType.TEXT,
            namespaceId: namespace.id,
          },
        });
      }

      // 为每种语言创建翻译
      for (const localeId of localeIds) {
        const existingTranslation = await prisma.translation.findUnique({
          where: {
            keyId_localeId: {
              keyId: key.id,
              localeId: localeId,
            },
          },
        });

        if (!existingTranslation) {
          const locale = projectLocales.find(
            (pl) => pl.locale.id === localeId,
          )?.locale;
          const isBaseLocale = localeId === baseLocaleId;

          // 基础语言直接生成内容，其他语言根据概率设置不同状态
          let status: TranslationStatus;
          let content: string;
          let submitterId: string | null = null;
          let reviewerId: string | null = null;
          let approvedAt: Date | null = null;

          if (isBaseLocale) {
            status = TranslationStatus.PUBLISHED;
            content = keyDef.defaultValue || keyDef.name;
          } else {
            // 随机分配翻译状态
            const rand = Math.random();
            if (rand < 0.2) {
              status = TranslationStatus.PENDING;
              content = '';
            } else if (rand < 0.4) {
              status = TranslationStatus.TRANSLATING;
              content = generateTranslationContent(
                locale?.code || 'en-US',
                keyDef.name,
              );
              submitterId = editorUserId || adminUserId;
            } else if (rand < 0.6) {
              status = TranslationStatus.REVIEWING;
              content = generateTranslationContent(
                locale?.code || 'en-US',
                keyDef.name,
              );
              submitterId = editorUserId || adminUserId;
            } else if (rand < 0.8) {
              status = TranslationStatus.APPROVED;
              content = generateTranslationContent(
                locale?.code || 'en-US',
                keyDef.name,
              );
              submitterId = editorUserId || adminUserId;
              reviewerId = reviewerUserId || adminUserId;
              approvedAt = new Date();
            } else {
              status = TranslationStatus.PUBLISHED;
              content = generateTranslationContent(
                locale?.code || 'en-US',
                keyDef.name,
              );
              submitterId = editorUserId || adminUserId;
              reviewerId = reviewerUserId || adminUserId;
              approvedAt = new Date();
            }
          }

          await prisma.translation.create({
            data: {
              keyId: key.id,
              localeId: localeId,
              content: content,
              status: status,
              priority:
                Math.random() > 0.7
                  ? TranslationPriority.HIGH
                  : TranslationPriority.MEDIUM,
              submitterId: submitterId,
              reviewerId: reviewerId,
              approvedAt: approvedAt,
              isLlmTranslated: Math.random() > 0.8,
            },
          });
        }
      }
    }
  }

  console.log(`    Created translations for ${project.name}`);
}

function generateKeysForNamespace(namespace: string): Array<{
  name: string;
  description?: string;
  type?: KeyType;
  defaultValue?: string;
}> {
  const keysMap: Record<
    string,
    Array<{
      name: string;
      description?: string;
      type?: KeyType;
      defaultValue?: string;
    }>
  > = {
    common: [
      { name: 'save', defaultValue: '保存', description: '保存按钮' },
      { name: 'cancel', defaultValue: '取消', description: '取消按钮' },
      { name: 'delete', defaultValue: '删除', description: '删除按钮' },
      { name: 'edit', defaultValue: '编辑', description: '编辑按钮' },
      { name: 'create', defaultValue: '创建', description: '创建按钮' },
      { name: 'search', defaultValue: '搜索', description: '搜索按钮' },
      { name: 'loading', defaultValue: '加载中...', description: '加载提示' },
      { name: 'noData', defaultValue: '暂无数据', description: '空数据提示' },
      { name: 'confirm', defaultValue: '确认', description: '确认按钮' },
      { name: 'close', defaultValue: '关闭', description: '关闭按钮' },
      { name: 'back', defaultValue: '返回', description: '返回按钮' },
      { name: 'next', defaultValue: '下一步', description: '下一步按钮' },
      { name: 'submit', defaultValue: '提交', description: '提交按钮' },
      { name: 'success', defaultValue: '操作成功', description: '成功提示' },
      { name: 'error', defaultValue: '操作失败', description: '错误提示' },
    ],
    auth: [
      {
        name: 'login.title',
        defaultValue: '用户登录',
        description: '登录页面标题',
      },
      {
        name: 'login.username',
        defaultValue: '用户名',
        description: '用户名输入框标签',
      },
      {
        name: 'login.password',
        defaultValue: '密码',
        description: '密码输入框标签',
      },
      { name: 'login.submit', defaultValue: '登录', description: '登录按钮' },
      {
        name: 'login.forgotPassword',
        defaultValue: '忘记密码？',
        description: '忘记密码链接',
      },
      {
        name: 'login.register',
        defaultValue: '注册账号',
        description: '注册链接',
      },
      {
        name: 'logout.confirm',
        defaultValue: '确认退出登录？',
        description: '退出确认提示',
      },
      {
        name: 'error.invalidCredentials',
        defaultValue: '用户名或密码错误',
        description: '登录错误提示',
      },
      {
        name: 'error.sessionExpired',
        defaultValue: '会话已过期，请重新登录',
        description: '会话过期提示',
      },
    ],
    user: [
      {
        name: 'profile.title',
        defaultValue: '个人资料',
        description: '个人资料页面标题',
      },
      { name: 'profile.name', defaultValue: '姓名', description: '姓名标签' },
      { name: 'profile.email', defaultValue: '邮箱', description: '邮箱标签' },
      {
        name: 'profile.phone',
        defaultValue: '手机号',
        description: '手机号标签',
      },
      { name: 'profile.avatar', defaultValue: '头像', description: '头像标签' },
      {
        name: 'profile.update',
        defaultValue: '更新资料',
        description: '更新资料按钮',
      },
      {
        name: 'settings.title',
        defaultValue: '账号设置',
        description: '设置页面标题',
      },
      {
        name: 'settings.language',
        defaultValue: '语言',
        description: '语言设置',
      },
      {
        name: 'settings.notifications',
        defaultValue: '通知设置',
        description: '通知设置',
      },
    ],
    product: [
      {
        name: 'list.title',
        defaultValue: '商品列表',
        description: '商品列表标题',
      },
      {
        name: 'detail.title',
        defaultValue: '商品详情',
        description: '商品详情标题',
      },
      { name: 'detail.price', defaultValue: '价格', description: '价格标签' },
      { name: 'detail.stock', defaultValue: '库存', description: '库存标签' },
      {
        name: 'detail.description',
        defaultValue: '商品描述',
        description: '描述标签',
      },
      {
        name: 'detail.addToCart',
        defaultValue: '加入购物车',
        description: '加入购物车按钮',
      },
      {
        name: 'detail.buyNow',
        defaultValue: '立即购买',
        description: '立即购买按钮',
      },
      {
        name: 'category.all',
        defaultValue: '全部分类',
        description: '全部分类',
      },
      {
        name: 'filter.priceRange',
        defaultValue: '价格区间',
        description: '价格筛选',
      },
      {
        name: 'sort.default',
        defaultValue: '默认排序',
        description: '默认排序',
      },
      {
        name: 'sort.priceAsc',
        defaultValue: '价格从低到高',
        description: '价格升序',
      },
      {
        name: 'sort.priceDesc',
        defaultValue: '价格从高到低',
        description: '价格降序',
      },
    ],
    order: [
      {
        name: 'list.title',
        defaultValue: '我的订单',
        description: '订单列表标题',
      },
      {
        name: 'detail.title',
        defaultValue: '订单详情',
        description: '订单详情标题',
      },
      {
        name: 'detail.orderNo',
        defaultValue: '订单编号',
        description: '订单号标签',
      },
      {
        name: 'detail.status',
        defaultValue: '订单状态',
        description: '状态标签',
      },
      {
        name: 'detail.total',
        defaultValue: '订单总额',
        description: '总额标签',
      },
      {
        name: 'status.pending',
        defaultValue: '待付款',
        description: '待付款状态',
      },
      {
        name: 'status.paid',
        defaultValue: '已付款',
        description: '已付款状态',
      },
      {
        name: 'status.shipped',
        defaultValue: '已发货',
        description: '已发货状态',
      },
      {
        name: 'status.completed',
        defaultValue: '已完成',
        description: '已完成状态',
      },
      { name: 'action.pay', defaultValue: '去支付', description: '支付按钮' },
      {
        name: 'action.cancel',
        defaultValue: '取消订单',
        description: '取消订单按钮',
      },
      {
        name: 'action.refund',
        defaultValue: '申请退款',
        description: '退款按钮',
      },
    ],
  };

  return keysMap[namespace] || [];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
