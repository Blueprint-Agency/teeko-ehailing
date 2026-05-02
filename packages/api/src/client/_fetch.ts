// client/_fetch.ts
// Base HTTP helper used by every domain client. Reads EXPO_PUBLIC_API_URL,
// injects the Clerk session token via a getter registered at app boot.
//
// The token getter is registered by apps/rider/lib/clerk.ts once the Clerk
// session is available (Task C4 wires it). Outside the rider app (e.g. tests)
// it returns null and requests are sent unauthenticated.

let tokenGetter: () => Promise<string | null> = async () => null;

export function setApiTokenGetter(fn: () => Promise<string | null>): void {
  tokenGetter = fn;
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

declare const process: { env: Record<string, string | undefined> };

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Add it to apps/rider/.env (e.g. http://localhost:5000)',
    );
  }
  return url;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenGetter();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
