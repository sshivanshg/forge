"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

export interface QueryResult<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Minimal client-side fetch hook. `key` identifies the resource; null skips the request.
 * Keeps the previous data while reloading so lists don't flash.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryResult<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetcher().then(
      (result) => {
        if (cancelled) return;
        setDataState(result);
        setError(null);
        setSettledKey(key);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, String(err)));
        setSettledKey(key);
      },
    );
    return () => {
      cancelled = true;
    };
    // The fetcher is recreated every render; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) =>
      typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater,
    );
  }, []);

  const loading = key !== null && settledKey !== key;
  return { data, error, loading, reload, setData };
}

/** Re-renders every `ms` milliseconds - keeps relative times and running durations fresh. */
export function useTick(ms = 1000, enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
  return tick;
}
