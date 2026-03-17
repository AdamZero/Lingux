import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  path: string;
  method: string;
  startTime: number;
}

@Injectable()
export class AsyncContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  run(context: RequestContext, callback: () => void): void {
    this.asyncLocalStorage.run(context, callback);
  }

  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  getRequestId(): string | undefined {
    return this.getContext()?.requestId;
  }

  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }
}
