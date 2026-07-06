const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PREFIX = `${BASE}/api/v1/admin`;
const ADMIN_DEV_USER =
  process.env.NEXT_PUBLIC_ADMIN_DEV_USER ?? '00000000-0000-0000-0000-0000000000a0';

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Teeko-User': ADMIN_DEV_USER,
    'X-Teeko-Role': 'admin_super',
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `DELETE ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  trips: number;
  joinDate: string | null;
  escalation: number;
  rating: number;
  totalSpent: number;
}

export interface EvpRecord {
  id: string;
  driverId: string;
  name: string;
  region: string;
  category: string;
  evp: 'not_applied' | 'pending' | 'approved' | 'expired' | 'rejected';
  applicationNo: string | null;
  evpExpiry: string | null;
  trips: number;
  joinDate: string | null;
  account: 'open' | 'closed';
}

export interface DocReviewRow {
  documentId: string;
  driverId: string;
  driverName: string;
  docType: string;
  category: string;
  fileUrl: string | null;
  uploadedAt: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

/** Resolve a stored document path (e.g. `/uploads/...`) to a fully-qualified URL. */
export function resolveFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  return /^https?:\/\//.test(fileUrl) ? fileUrl : `${BASE}${fileUrl}`;
}

export interface NewRider {
  name: string;
  phone?: string;
  email?: string;
}

export const adminApi = {
  getRiders: () => get<Rider[]>('/riders'),

  createRider: (input: NewRider) => post<Rider>('/riders', input),

  deleteRider: (id: string) => del<{ ok: boolean }>(`/riders/${id}`),

  getEvpRecords: () => get<EvpRecord[]>('/drivers/evp'),

  getDocumentQueue: () => get<DocReviewRow[]>('/drivers/documents'),

  reviewDocument: (documentId: string, status: 'approved' | 'rejected', reason?: string) =>
    post<{ ok: boolean; evpCreated: boolean; driverId: string | null }>(
      `/drivers/documents/${documentId}/review`,
      { status, reason },
    ),

  updateEvpStatus: (recordId: string, status: EvpRecord['evp']) =>
    post<{ ok: boolean; status: EvpRecord['evp'] }>(
      `/drivers/evp/${recordId}/status`,
      { status },
    ),

  openEvpAccount: (recordId: string) =>
    post<{ ok: boolean; account: 'open' }>(`/drivers/evp/${recordId}/open-account`, {}),
};
