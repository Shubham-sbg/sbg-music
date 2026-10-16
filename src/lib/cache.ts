import { requestQueue } from './requestQueue';

/**
 * Application-wide Cache and Request Deduplication Engine
 * Prevents redundant Firestore & API requests, eliminates rate limiting,
 * and provides structured logging in development.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const STORAGE_PREFIX = 'sbg_cache_v3_';

function readFromStorage<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();
    // Allow up to 2x TTL for stale-while-revalidate fallback
    if (now - entry.timestamp < ttlMs * 2) {
      return entry.data;
    }
  } catch {
    // Ignore parse or storage errors
  }
  return null;
}

function writeToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Handle localStorage quota limits gracefully
  }
}

function removeFromStorage(keyOrPrefix?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!keyOrPrefix) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      return;
    }
    const targetKey = STORAGE_PREFIX + keyOrPrefix;
    localStorage.removeItem(targetKey);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(targetKey)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

const IS_DEV = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;

export function logDev(category: string, message: string, detail?: any) {
  if (IS_DEV) {
    console.log(`%c[${category}] %c${message}`, 'color: #9333ea; font-weight: bold;', 'color: #e5e7eb;', detail ?? '');
  }
}

export function getCachedData<T>(key: string, ttlMs = 300000): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data as T;
  }
  const fromDisk = readFromStorage<T>(key, ttlMs);
  if (fromDisk !== null) {
    memoryCache.set(key, { data: fromDisk, timestamp: Date.now() });
    return fromDisk;
  }
  return null;
}

export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
  writeToStorage(key, data);
}

/**
 * Wraps any async request with in-memory & persistent caching, in-flight deduplication,
 * and centralized request queue throttling to prevent rate limit errors.
 * @param key Unique key for the request dataset
 * @param fetcher Async function executing the query or API call
 * @param ttlMs Time-to-live in milliseconds (default: 2 minutes = 120000ms)
 */
export async function dedupeRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 120000
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key);

  // 1. Check valid memory cache
  if (cached && now - cached.timestamp < ttlMs) {
    logDev('CACHE_HIT', `Serving key "${key}" from memory cache (${Math.round((now - cached.timestamp) / 1000)}s old)`);
    return cached.data as T;
  }

  // 2. Check localStorage persistent cache for instant 0ms delivery
  const stored = readFromStorage<T>(key, ttlMs);
  if (stored !== null) {
    memoryCache.set(key, { data: stored, timestamp: now });
    logDev('PERSISTENT_CACHE_HIT', `Serving key "${key}" from disk cache`);

    // If cache is older than half TTL, trigger silent background revalidation
    if (!inFlightRequests.has(key)) {
      const revalidatePromise = requestQueue.enqueue(fetcher, key)
        .then((fresh) => {
          memoryCache.set(key, { data: fresh, timestamp: Date.now() });
          writeToStorage(key, fresh);
          return fresh;
        })
        .catch((err) => {
          logDev('BACKGROUND_REVALIDATE_WARN', `Background revalidation failed for "${key}":`, err);
          return stored;
        })
        .finally(() => {
          inFlightRequests.delete(key);
        });
      inFlightRequests.set(key, revalidatePromise);
    }
    return stored;
  }

  // 3. Check in-flight deduplication promise
  if (inFlightRequests.has(key)) {
    logDev('DEDUPE_HIT', `Deduplicating concurrent request for key "${key}"`);
    return inFlightRequests.get(key) as Promise<T>;
  }

  // 4. Initiate request through centralized request queue
  logDev('FETCH_START', `Executing queued fetch for key "${key}"`);
  const promise = (async () => {
    try {
      const data = await requestQueue.enqueue(fetcher, key);
      memoryCache.set(key, { data, timestamp: Date.now() });
      writeToStorage(key, data);
      return data;
    } catch (err: any) {
      logDev('FETCH_ERROR', `Request failed for key "${key}"`, err);
      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Manually invalidates cache entries matching a key or prefix pattern.
 */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    memoryCache.clear();
    removeFromStorage();
    logDev('CACHE_CLEAR', 'Cleared entire memory and disk cache');
    return;
  }

  let count = 0;
  for (const key of memoryCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memoryCache.delete(key);
      count++;
    }
  }
  removeFromStorage(keyOrPrefix);
  logDev('CACHE_INVALIDATE', `Invalidated ${count} cache entries matching "${keyOrPrefix}"`);
}

/**
 * Detects whether an error is a rate limit or quota exceeded error.
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.code || error).toLowerCase();
  return (
    msg.includes('rate exceeded') ||
    msg.includes('rate_exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('429')
  );
}

/**
 * Returns user-friendly error messages based on admin vs normal user roles.
 */
export function formatErrorMessage(error: any, isAdmin = false, defaultMsg = 'An unexpected error occurred.'): string {
  if (isRateLimitError(error)) {
    if (isAdmin) {
      const detail = error?.message || error?.code || String(error);
      return `[Admin Diagnostic] Rate limit or quota exceeded. Service details: ${detail}`;
    }
    return 'Too many requests. Please try again in a moment.';
  }

  return error?.message || defaultMsg;
}
