import { describe, it, expect, vi } from "vitest";
import { createSemanticCache, cosineSimilarity } from "../src/mastra/config/semantic-cache";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for zero vector", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("handles multi-dimensional vectors correctly", () => {
    const a = [0.5, 0.5, 0.5, 0.5];
    const b = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});

describe("createSemanticCache", () => {
  it("starts empty", () => {
    const cache = createSemanticCache();
    expect(cache.size()).toBe(0);
  });

  it("returns null on cache miss", () => {
    const cache = createSemanticCache<string>();
    expect(cache.get([1, 0, 0])).toBeNull();
  });

  it("hits cache for identical embedding", () => {
    const cache = createSemanticCache<string>();
    cache.set([1, 0, 0], "arroz");
    expect(cache.get([1, 0, 0])).toBe("arroz");
  });

  it("hits cache for highly similar embedding (> 0.95)", () => {
    const cache = createSemanticCache<string>();
    const stored = [0.999, 0.001, 0.001];
    const query  = [0.998, 0.002, 0.001];
    cache.set(stored, "feijão");
    expect(cache.get(query)).toBe("feijão");
  });

  it("misses cache for dissimilar embedding", () => {
    const cache = createSemanticCache<string>();
    cache.set([1, 0, 0], "arroz");
    expect(cache.get([0, 1, 0])).toBeNull();
  });

  it("evicts oldest entry when maxSize is reached", () => {
    const cache = createSemanticCache<string>({ maxSize: 2 });
    cache.set([1, 0, 0], "entry-1");
    cache.set([0, 1, 0], "entry-2");
    cache.set([0, 0, 1], "entry-3"); // should evict entry-1
    expect(cache.size()).toBe(2);
    expect(cache.get([1, 0, 0])).toBeNull(); // evicted
    expect(cache.get([0, 1, 0])).toBe("entry-2");
    expect(cache.get([0, 0, 1])).toBe("entry-3");
  });

  it("removes expired entries on get", () => {
    vi.useFakeTimers();
    const cache = createSemanticCache<string>({ ttlMs: 1000 });
    cache.set([1, 0, 0], "arroz");
    expect(cache.get([1, 0, 0])).toBe("arroz");

    vi.advanceTimersByTime(1500); // past TTL
    expect(cache.get([1, 0, 0])).toBeNull();
    vi.useRealTimers();
  });

  it("clear() empties the cache", () => {
    const cache = createSemanticCache<string>();
    cache.set([1, 0, 0], "arroz");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get([1, 0, 0])).toBeNull();
  });

  it("stores multiple entries and retrieves each correctly", () => {
    const cache = createSemanticCache<number>();
    cache.set([1, 0, 0], 1);
    cache.set([0, 1, 0], 2);
    cache.set([0, 0, 1], 3);
    expect(cache.get([1, 0, 0])).toBe(1);
    expect(cache.get([0, 1, 0])).toBe(2);
    expect(cache.get([0, 0, 1])).toBe(3);
    expect(cache.size()).toBe(3);
  });
});
