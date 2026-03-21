import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';

const asyncContext = new AsyncLocalStorage();
function getCurrentUserId() {
  return asyncContext.getStore()?.userId || "anonymous";
}
function getCurrentJwtToken() {
  return asyncContext.getStore()?.jwtToken;
}

function extractAuthContext(executionContext) {
  const userId = executionContext?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) || getCurrentUserId();
  const authToken = executionContext?.requestContext?.get("jwt_token") || getCurrentJwtToken();
  return { userId, authToken };
}

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "dd/mm/yyyy HH:MM:ss",
      ignore: "pid,hostname"
    }
  }
});

export { asyncContext as a, extractAuthContext as e, logger as l };
