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
  uploadedAt: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

export const adminApi = {
  getEvpRecords: () => get<EvpRecord[]>('/drivers/evp'),

  getDocumentQueue: () => get<DocReviewRow[]>('/drivers/documents'),

  reviewDocument: (documentId: string, status: 'approved' | 'rejected', reason?: string) =>
    post<{ ok: boolean; evpCreated: boolean; driverId: string | null }>(
      `/drivers/documents/${documentId}/review`,
      { status, reason },
    ),
};
