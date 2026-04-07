/**
 * Per-user chat queue — prevents concurrent message processing for the same user.
 *
 * The chat endpoint streams responses, so we can't easily buffer and replay them.
 * Instead, we track which users are actively processing a message and reject new
 * requests with 429 until the current one finishes. This avoids thread memory
 * corruption from concurrent writes to the same Mastra thread.
 */

const activeUsers = new Set<string>();

/**
 * Acquires the lock for a given userId.
 * Returns true if acquired, false if the user already has a request in-flight.
 */
export function acquireChatLock(userId: string): boolean {
  if (activeUsers.has(userId)) return false;
  activeUsers.add(userId);
  return true;
}

/**
 * Releases the lock for a given userId.
 * Must be called once the request (stream) is complete.
 */
export function releaseChatLock(userId: string): void {
  activeUsers.delete(userId);
}

/**
 * Returns the number of users currently processing a message.
 * Useful for health checks and observability.
 */
export function activeChatCount(): number {
  return activeUsers.size;
}
