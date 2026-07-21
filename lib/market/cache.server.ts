import "server-only";

export const SNAPSHOT_TTL_MS = 10_000;
export const BARS_TTL_MS = 5 * 60_000;
export const SEC_TTL_MS = 6 * 60 * 60_000;
export const SNAPSHOT_MAX_STALE_MS = 5 * 60_000;
export const BARS_MAX_STALE_MS = 24 * 60 * 60_000;
export const SEC_MAX_STALE_MS = 7 * 24 * 60 * 60_000;

export class MarketDataUnavailableError extends Error {
  constructor(message = "Market data is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "MarketDataUnavailableError";
  }
}

type CacheEntry<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
};

type TtlCacheOptions = {
  ttlMs: number;
  maxStaleMs?: number;
  now?: () => number;
};

export function createTtlCache<T>({
  ttlMs,
  maxStaleMs = Number.POSITIVE_INFINITY,
  now = Date.now,
}: TtlCacheOptions) {
  const entries = new Map<string, CacheEntry<T>>();
  const pending = new Map<string, Promise<{ value: T; stale: boolean }>>();

  async function load(
    key: string,
    loader: () => Promise<T>,
  ): Promise<{ value: T; stale: boolean }> {
    const existing = entries.get(key);
    if (existing && existing.expiresAt > now()) {
      return { value: existing.value, stale: false };
    }

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const request = loader()
      .then((value) => {
        const storedAt = now();
        entries.set(key, { value, storedAt, expiresAt: storedAt + ttlMs });
        return { value, stale: false };
      })
      .catch((error: unknown) => {
        if (existing && now() - existing.storedAt <= maxStaleMs) {
          return { value: existing.value, stale: true };
        }
        entries.delete(key);
        throw new MarketDataUnavailableError("Provider request failed", {
          cause: error,
        });
      })
      .finally(() => pending.delete(key));

    pending.set(key, request);
    return request;
  }

  return {
    getOrLoad: load,
    peek(key: string) {
      return entries.get(key)?.value;
    },
    set(key: string, value: T) {
      const storedAt = now();
      entries.set(key, { value, storedAt, expiresAt: storedAt + ttlMs });
    },
    clear() {
      entries.clear();
      pending.clear();
    },
  };
}
