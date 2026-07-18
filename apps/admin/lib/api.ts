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
  // No Content-Type header — DELETE has no body and Fastify rejects
  // 'application/json' with an empty body (FST_ERR_CTP_EMPTY_JSON_BODY).
  const { 'Content-Type': _, ...noContentType } = headers() as Record<string, string>;
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'DELETE',
    headers: noContentType,
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

export type AdminUserRole = 'super_admin' | 'admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: string;
  lastLogin: string | null;
  createdAt: string | null;
}

export interface NewAdmin {
  name: string;
  email: string;
  role: AdminUserRole;
}


async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `PUT ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface CommissionDriverRow {
  id: string;
  name: string;
  category: string;
  trips: number;
  /** Effective rate as a percentage (e.g. 20 = 20%). */
  rate: number;
  rateBps: number;
  /** Which tier resolved this rate. */
  source: 'driver' | 'category' | 'platform';
}

export interface CommissionCategoryRow {
  category: string;
  rateBps: number;
  rate: number;
  isOverride: boolean;
}

export interface CommissionDriverOverride {
  driverId: string;
  name: string;
  category: string;
  rateBps: number;
  rate: number;
  note: string | null;
  updatedAt: string;
}

export interface CommissionSettings {
  platform: { rateBps: number; rate: number };
  categories: CommissionCategoryRow[];
  driverOverrides: CommissionDriverOverride[];
}

export interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
  color: string | null;
}

// ── Feedback & Disputes ───────────────────────────────────────────────────────
export interface FeedbackRow {
  id: string;
  userName: string;
  tripId: string | null;
  role: 'rider' | 'driver';
  category: 'app' | 'driver' | 'ride' | 'payment' | 'suggestion' | 'other';
  rating: number | null;
  message: string;
  createdAt: string;
}

export type DisputeStatus =
  | 'open'
  | 'escalated'
  | 'refund_pending'
  | 'refund_processing'
  | 'refund_completed'
  | 'refund_failed'
  | 'rejected';

export interface DisputeRow {
  id: string;
  tripId: string | null;
  raisedBy: 'rider' | 'driver';
  raiserName: string;
  category: string;
  status: DisputeStatus;
  /** Refundable amount in RM. */
  amount: number;
  amountCents: number;
  description: string;
  resolutionNote: string | null;
  refundNote: string | null;
  refundRef: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export type DisputeQueue = 'dispute' | 'refund' | 'completed';
export type DisputeAction = 'reject' | 'approve_refund' | 'escalate';
export type RefundStatus = 'refund_processing' | 'refund_completed' | 'refund_failed';

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

  getAdmins: () => get<AdminUser[]>('/admins'),

  createAdmin: (input: NewAdmin) => post<AdminUser>('/admins', input),

  deactivateAdmin: (id: string) => post<{ ok: boolean }>(`/admins/${id}/deactivate`, {}),

  // ── Commissions ─────────────────────────────────────────────────────────────
  getCommissionSettings: () =>
    get<CommissionSettings>('/commissions/settings'),

  getCommissionDrivers: () =>
    get<CommissionDriverRow[]>('/commissions/drivers'),

  updatePlatformRate: (rate: number, note?: string) =>
    put<{ ok: boolean; rate: number; rateBps: number }>(
      '/commissions/platform',
      { rate, note },
    ),

  updateCategoryRate: (category: string, rate: number, note?: string) =>
    put<{ ok: boolean; category: string; rate: number; rateBps: number }>(
      `/commissions/categories/${category}`,
      { rate, note },
    ),

  deleteCategoryRate: (category: string) =>
    del<{ ok: boolean; category: string; clearedToDefault: boolean }>(
      `/commissions/categories/${category}`,
    ),

  updateDriverCommission: (driverId: string, rate: number, note?: string) =>
    put<{ ok: boolean; driverId: string; rate: number; rateBps: number }>(
      `/commissions/drivers/${driverId}`,
      { rate, note },
    ),

  deleteDriverCommission: (driverId: string) =>
    del<{ ok: boolean; driverId: string; clearedToDefault: boolean }>(
      `/commissions/drivers/${driverId}`,
    ),

  // ── Surge ────────────────────────────────────────────────────────────────────
  getSurgeZones: () => get<SurgeZone[]>('/surge/zones'),

  updateSurgeZone: (id: string, changes: { multiplier?: number; active?: boolean }) =>
    put<{ ok: boolean; zone: SurgeZone }>(`/surge/zones/${id}`, changes),

  // ── Feedback ─────────────────────────────────────────────────────────────────
  getFeedback: () => get<FeedbackRow[]>('/feedback'),

  // ── Disputes ─────────────────────────────────────────────────────────────────
  getDisputes: (queue?: DisputeQueue) =>
    get<DisputeRow[]>(`/disputes${queue ? `?queue=${queue}` : ''}`),

  resolveDispute: (id: string, action: DisputeAction, note?: string) =>
    post<{ ok: boolean; dispute: DisputeRow }>(`/disputes/${id}/resolve`, { action, note }),

  updateRefundStatus: (id: string, status: RefundStatus, note?: string, ref?: string) =>
    put<{ ok: boolean; dispute: DisputeRow }>(`/disputes/${id}/refund`, { status, note, ref }),
};
