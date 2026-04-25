/**
 * Prisma select helpers - 可复用的字段选择器
 * 用于统一返回数据结构，避免大小写转换问题
 */

/**
 * Key 的基础字段选择器
 */
export const keySelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  namespaceId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Locale 的基础字段选择器
 */
export const localeSelect = {
  id: true,
  code: true,
  name: true,
} as const;

/**
 * Translation 的字段选择器（包含 locale，不含 orderBy）
 */
export const translationSelect = {
  id: true,
  content: true,
  status: true,
  reviewComment: true,
  createdAt: true,
  updatedAt: true,
  locale: {
    select: localeSelect,
  },
} as const;

/**
 * Namespace 的字段选择器
 */
export const namespaceSelect = {
  id: true,
  name: true,
  description: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * 带 translations 的 Key 选择器（不含 orderBy）
 */
export const keyWithTranslationsSelect = {
  ...keySelect,
  translations: {
    select: translationSelect,
  },
} as const;
