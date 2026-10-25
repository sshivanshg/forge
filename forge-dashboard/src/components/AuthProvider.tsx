"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api, ApiError, clearTokens, getAccessToken, getRefreshToken, setTokens, subscribeTokens } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "unreachable";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const hasTokenSnapshot = () => getAccessToken() !== null;
const serverSnapshot = () => null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // null while hydrating (localStorage is unknown on the server), then true/false.
  const hasToken = useSyncExternalStore<boolean | null>(subscribeTokens, hasTokenSnapshot, serverSnapshot);
  const [user, setUser] = useState<User | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    api.auth.me().then(
      (me) => {
        if (cancelled) return;
        setUser(me);
        setUnreachable(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        // A 401 has already cleared the tokens and redirected; anything else means the API is down.
        if (!(err instanceof ApiError) || err.status !== 401) setUnreachable(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hasToken, attempt]);

  const login = useCallback(async (email: string, password: string) => {
    const pair = await api.auth.login({ email, password });
    setUser(null);
    setTokens(pair);
    setUser(await api.auth.me());
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch {
        // The session is dropped locally either way.
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const retry = useCallback(() => {
    setUnreachable(false);
    setAttempt((a) => a + 1);
  }, []);

  let status: AuthStatus;
  if (hasToken === null) status = "loading";
  else if (!hasToken) status = "anonymous";
  else if (user) status = "authenticated";
  else if (unreachable) status = "unreachable";
  else status = "loading";

  const value = useMemo(
    () => ({ status, user: hasToken ? user : null, login, logout, retry }),
    [status, user, hasToken, login, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
