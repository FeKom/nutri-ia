import { AsyncLocalStorage } from 'node:async_hooks';
import type { UserProfile } from '../mastra/config/memory';

interface RequestContext {
  userId: string;
  jwtToken?: string;
  userProfile?: UserProfile | null;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();

export function getCurrentUserId(): string {
  return asyncContext.getStore()?.userId || 'anonymous';
}

export function getCurrentJwtToken(): string | undefined {
  return asyncContext.getStore()?.jwtToken;
}
