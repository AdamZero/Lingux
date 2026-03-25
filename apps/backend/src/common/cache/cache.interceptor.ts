import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache/cache.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from '../cache/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const baseKey = this.reflector.getAllAndOverride<string>(
      CACHE_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );

    const ttl = this.reflector.getAllAndOverride<number>(CACHE_TTL_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!baseKey) {
      return next.handle();
    }

    // 生成包含查询参数的完整缓存 key
    const request = context.switchToHttp().getRequest();
    const queryString = request.url.split('?')[1] || '';
    const key = queryString ? `${baseKey}:${queryString}` : baseKey;

    const cachedData = this.cacheService.get(key);
    if (cachedData) {
      return of(cachedData);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cacheService.set(key, data, ttl);
      }),
    );
  }
}
