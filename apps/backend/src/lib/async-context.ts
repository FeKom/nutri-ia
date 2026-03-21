import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  userId: string;
  jwtToken?: string;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();

export function getCurrentUserId(): string {
  return asyncContext.getStore()?.userId || 'anonymous';
}

export function getCurrentJwtToken(): string | undefined {
  return asyncContext.getStore()?.jwtToken;
}
