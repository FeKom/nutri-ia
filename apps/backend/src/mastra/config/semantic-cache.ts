/**
 * Semantic Cache — in-memory LRU cache keyed by embedding similarity.
 *
 * Entries are considered a cache hit when cosine similarity between the
 * stored embedding and the query embedding exceeds SIMILARITY_THRESHOLD.
 * Eviction follows LRU order via Map insertion ordering.
 */

const SIMILARITY_THRESHOLD = 0.95;

type CacheEntry<T> = { value: T; embedding: number[]; createdAt: number };

type SemanticCache<T> = {
  get(queryEmbedding: number[]): T | null;
  set(queryEmbedding: number[], value: T): void;
  clear(): void;
  size(): number;
};

type SemanticCacheOptions = {
  maxSize?: number;
  ttlMs?: number;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

export const createSemanticCache = <T>(options: SemanticCacheOptions = {}): SemanticCache<T> => {
  const maxSize = options.maxSize ?? 100;
  const ttlMs = options.ttlMs ?? 300_000;

  // Map preserves insertion order — oldest entry is first
  const store = new Map<string, CacheEntry<T>>();
  let keyCounter = 0;

  const purgeExpired = (now: number): void => {
    for (const [key, entry] of store) {
      if (now - entry.createdAt > ttlMs) {
        store.delete(key);
      }
    }
  };

  const get = (queryEmbedding: number[]): T | null => {
    const now = Date.now();
    purgeExpired(now);

    for (const entry of store.values()) {
      if (cosineSimilarity(queryEmbedding, entry.embedding) >= SIMILARITY_THRESHOLD) {
        return entry.value;
      }
    }
    return null;
  };

  const set = (queryEmbedding: number[], value: T): void => {
    if (store.size >= maxSize) {
      // Evict oldest (first inserted key)
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) store.delete(firstKey);
    }
    store.set(String(keyCounter++), { value, embedding: queryEmbedding, createdAt: Date.now() });
  };

  const clear = (): void => { store.clear(); };

  const size = (): number => store.size;

  return { get, set, clear, size };
};
