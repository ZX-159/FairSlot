import type { Session } from '@supabase/supabase-js';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status = 500, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type AuthFetchOptions = RequestInit & {
  /** Abort after ms (default 25000). */
  timeoutMs?: number;
  /** Retry count for network / 502-504 (default 1). */
  retries?: number;
};

export async function authFetch(
  url: string,
  session: Session | null,
  options: AuthFetchOptions = {}
) {
  const { timeoutMs = 25000, retries = 1, ...init } = options;
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  headers.set('Accept', 'application/json');

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: init.signal || ctrl.signal,
      });
      clearTimeout(timer);
      // Retry transient gateway errors
      if ([502, 503, 504].includes(res.status) && attempt < retries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError('Request timed out. Check your connection and try again.', 408);
      }
      throw new ApiError('Network error. Check your connection and try again.', 0);
    }
  }
  throw lastErr instanceof Error ? lastErr : new ApiError('Request failed');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function parseJsonSafe<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Parse JSON and throw ApiError when !res.ok */
export async function readApi<T = unknown>(res: Response): Promise<T> {
  const data = await parseJsonSafe<T & { error?: string }>(res);
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(String(msg), res.status, data);
  }
  return data as T;
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Date TBC';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBC';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatRelative(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export function isUnauthorized(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}
