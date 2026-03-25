import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';

/**
 * 缓存装饰器
 * @param key 缓存键
 * @param ttl 过期时间（毫秒），默认 5 分钟
 */
export const Cache = (key: string, ttl: number = 300000) =>
  SetMetadata(CACHE_KEY_METADATA, key) && SetMetadata(CACHE_TTL_METADATA, ttl);
