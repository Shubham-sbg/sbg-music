import { useState, useEffect, useCallback } from 'react';
import { dedupeRequest, getCachedData, setCachedData, invalidateCache } from '../lib/cache';

export interface SWROptions<T> {
  ttlMs?: number;
  initialData?: T;
}

/**
 * Custom Stale-While-Revalidate (SWR) Hook
 * Serves cached data instantly if available, then revalidates in the background via dedupeRequest + requestQueue.
 */
export function useSWRData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: SWROptions<T> = {}
) {
  const { ttlMs = 120000, initialData } = options;

  const [data, setData] = useState<T | null>(() => {
    if (!key) return initialData ?? null;
    const cached = getCachedData<T>(key);
    return cached !== null ? cached : (initialData ?? null);
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (!key) return false;
    return getCachedData<T>(key) === null && initialData === undefined;
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const revalidate = useCallback(
    async (forceRefresh = false) => {
      if (!key) return;

      if (forceRefresh) {
        invalidateCache(key);
      }

      setIsValidating(true);
      if (getCachedData<T>(key) === null) {
        setLoading(true);
      }

      try {
        const fetched = await dedupeRequest<T>(key, fetcher, ttlMs);
        setData(fetched);
        setError(null);
      } catch (err: any) {
        console.error(`[useSWRData] Revalidation error for key "${key}":`, err);
        setError(err);
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    },
    [key, fetcher, ttlMs]
  );

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  const mutate = useCallback(
    (newData: T, shouldRevalidate = false) => {
      if (key) {
        setCachedData(key, newData);
      }
      setData(newData);
      if (shouldRevalidate) {
        revalidate(true);
      }
    },
    [key, revalidate]
  );

  return {
    data,
    setData,
    loading,
    isValidating,
    error,
    mutate,
    refetch: () => revalidate(true),
  };
}
