import type {
  CreateProjectInput,
  Deployment,
  EnvVar,
  GitHubConnection,
  GitHubRepo,
  Insight,
  LogLine,
  Page,
  ProblemDetail,
  Project,
  TokenPair,
  UpdateProjectInput,
  User,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");
export const API_BASE = `${API_URL}/api/v1`;

// ---------------------------------------------------------------- token store
//
// Tokens live in localStorage so a page refresh keeps the session. This is a demo-friendly
// trade-off: a production deployment would keep the refresh token in an httpOnly, SameSite
// cookie so that injected scripts cannot read it.

const ACCESS_KEY = "forge.accessToken";
const REFRESH_KEY = "forge.refreshToken";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function setTokens(pair: Pick<TokenPair, "accessToken" | "refreshToken">): void {
  const s = storage();
  s?.setItem(ACCESS_KEY, pair.accessToken);
  s?.setItem(REFRESH_KEY, pair.refreshToken);
  listeners.forEach((l) => l());
}

export function clearTokens(): void {
  const s = storage();
  s?.removeItem(ACCESS_KEY);
  s?.removeItem(REFRESH_KEY);
  listeners.forEach((l) => l());
}

/** Subscribe to token changes in this tab and in other tabs (for useSyncExternalStore). */
export function subscribeTokens(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACCESS_KEY || e.key === REFRESH_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------- errors

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail | null;
  /** Field name -> message, from the problem's `errors` array (validation failures). */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, problem: ProblemDetail | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.fieldErrors = {};
    for (const e of problem?.errors ?? []) {
      if (!(e.field in this.fieldErrors)) this.fieldErrors[e.field] = e.message;
    }
  }

  get code(): string | undefined {
    return this.problem?.code;
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: ProblemDetail | null = null;
  try {
    const text = await res.text();
    if (text) problem = JSON.parse(text) as ProblemDetail;
  } catch {
    // not JSON - fall through to a generic message
  }
  const message =
    problem?.detail || problem?.title || `${res.status} ${res.statusText || "Request failed"}`;
  return new ApiError(res.status, message, problem);
}

// ---------------------------------------------------------------- refresh (single-flight)

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a new pair. Concurrent callers share one request, so a burst
 * of 401s triggers exactly one refresh.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      setTokens((await res.json()) as TokenPair);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function redirectToLogin(): void {
  clearTokens();
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname.startsWith("/login")) return;
  // Outside React (no router here): a full navigation also drops any in-memory state of the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login?next=${encodeURIComponent(here)}`;
}

// ---------------------------------------------------------------- request

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  body?: unknown;
  /** Send the bearer token and refresh on 401 (default true). */
  auth?: boolean;
}

async function send(method: Method, path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = opts.auth === false ? null : getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the Forge API at ${API_URL}. Is forge-server running?`);
  }
}

export async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(method, path, opts);

  if (res.status === 401 && opts.auth !== false) {
    if (await refreshAccessToken()) {
      res = await send(method, path, opts);
    }
    if (res.status === 401) {
      redirectToLogin();
      throw await toApiError(res);
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** URL for an SSE endpoint. EventSource cannot send headers, so the token rides in the query. */
export function streamUrl(path: string): string {
  const token = getAccessToken() ?? "";
  const sep = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------- endpoints

const enc = encodeURIComponent;

export const api = {
  auth: {
    register: (body: { email: string; password: string; displayName: string }) =>
      request<User>("POST", "/auth/register", { body, auth: false }),
    login: (body: { email: string; password: string }) =>
      request<TokenPair>("POST", "/auth/login", { body, auth: false }),
    logout: (refreshToken: string) =>
      request<void>("POST", "/auth/logout", { body: { refreshToken }, auth: false }),
    me: () => request<User>("GET", "/me"),
  },

  github: {
    connection: () => request<GitHubConnection>("GET", "/github/connection"),
    connect: () => request<{ authorizeUrl: string }>("POST", "/github/connect"),
    disconnect: () => request<void>("DELETE", "/github/connection"),
    repos: () => request<GitHubRepo[]>("GET", "/github/repos"),
    branches: (owner: string, name: string) =>
      request<string[]>("GET", `/github/repos/${enc(owner)}/${enc(name)}/branches`),
  },

  projects: {
    list: (page = 0, size = 20) => request<Page<Project>>("GET", `/projects?page=${page}&size=${size}`),
    get: (id: string) => request<Project>("GET", `/projects/${enc(id)}`),
    create: (body: CreateProjectInput) => request<Project>("POST", "/projects", { body }),
    update: (id: string, body: UpdateProjectInput) =>
      request<Project>("PATCH", `/projects/${enc(id)}`, { body }),
    remove: (id: string) => request<void>("DELETE", `/projects/${enc(id)}`),
  },

  env: {
    list: (projectId: string) => request<EnvVar[]>("GET", `/projects/${enc(projectId)}/env`),
    upsert: (projectId: string, vars: Record<string, string>) =>
      request<void>("PUT", `/projects/${enc(projectId)}/env`, { body: { vars } }),
    remove: (projectId: string, key: string) =>
      request<void>("DELETE", `/projects/${enc(projectId)}/env/${enc(key)}`),
  },

  deployments: {
    create: (projectId: string, commitSha?: string) =>
      request<Deployment>("POST", `/projects/${enc(projectId)}/deployments`, {
        body: commitSha ? { commitSha } : {},
      }),
    list: (projectId: string, page = 0, size = 20) =>
      request<Page<Deployment>>("GET", `/projects/${enc(projectId)}/deployments?page=${page}&size=${size}`),
    get: (id: string) => request<Deployment>("GET", `/deployments/${enc(id)}`),
    cancel: (id: string) => request<Deployment>("POST", `/deployments/${enc(id)}/cancel`),
    rollback: (id: string) => request<Deployment>("POST", `/deployments/${enc(id)}/rollback`),
    logs: (id: string, after = 0, limit = 500) =>
      request<LogLine[]>("GET", `/deployments/${enc(id)}/logs?after=${after}&limit=${limit}`),
    insight: (id: string) => request<Insight>("GET", `/deployments/${enc(id)}/insight`),
    logStreamPath: (id: string) => `/deployments/${enc(id)}/logs/stream`,
    runtimeStreamPath: (projectId: string) => `/projects/${enc(projectId)}/runtime-logs/stream`,
  },
};
