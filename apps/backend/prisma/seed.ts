import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({
  path: path.join(__dirname, '..', '.env'),
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
