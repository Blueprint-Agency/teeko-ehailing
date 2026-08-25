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

export interface Driver {
  id: string;
  name: string;
  ic: string;
  phone: string;
  email: string;
  city: string;
  category: string;
  status: string;
  evp: string;
  account: 'open' | 'closed';
  rating: number;
  trips: number;
  joinDate: string;
  vehicle: string;
  plate: string;
  earnings: number;
}

export type DriverStatus = 'active' | 'pending' | 'suspended' | 'inactive';

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

/**
 * The general KL surge — the base multiplier applied wherever no active zone
 * covers the pickup. Surge zones override this rate.
 */
export interface SurgeConfig {
  multiplier: number;
  updatedAt: string | null;
}

export interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
  color: string | null;
  /** Outer-ring boundary of the zone, for rendering on the surge map. */
  polygon: { lat: number; lng: number }[];
}

export interface Trip {
  id: string;
  driverId: string;
  riderId: string;
  status: string;
  category: string;
  city: string;
  /** ISO timestamp. */
  date: string;
  pickup: string;
  dropoff: string;
  /** Kilometres. */
  distance: number;
  /** Ringgit (RM), not sen. */
  fare: number;
  /** Teeko's commission on this trip, in RM. */
  commission: number;
  surge: number;
  paymentMethod: string;
  dispute: boolean;
}

export interface MetricsOverview {
  activeTrips: number;
  driversOnline: number;
  activeDrivers: number;
  todayTrips: number;
  /** Day-over-day % change; null when yesterday had none to compare against. */
  todayTripsDeltaPct: number | null;
  /** Ringgit (RM). */
  todayRevenue: number;
  todayRevenueDeltaPct: number | null;
  openDisputes: number;
  totalRiders: number;
  newRidersThisWeek: number;
  todayByCategory: { category: string; trips: number }[];
}

export interface LiveTrip {
  id: string;
  driver: string;
  category: string;
  status: 'matched' | 'driver_arrived' | 'in_trip';
  pickup: string | null;
  dropoff: string | null;
  /** Current position — latest GPS breadcrumb, or the pickup point if none yet. */
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string | null;
  /** true = real GPS fix; false = pickup fallback (driver hasn't emitted GPS). */
  live: boolean;
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
export type DisputeAction = 'reject' | 'approve_refund';
export type RefundStatus = 'refund_processing' | 'refund_completed' | 'refund_failed';

// ── Support tickets ───────────────────────────────────────────────────────────
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';

export interface SupportTicketRow {
  id: string;
  subject: string;
  raisedBy: string;
  userId: string;
  status: SupportTicketStatus;
  priority: string;
  category: string;
  date: string;
  assignedTo: string | null;
  messages: number;
}

// ── Revenue reports ───────────────────────────────────────────────────────────
export interface RevenueDay {
  date: string;
  trips: number;
  /** Major-unit ringgit (RM), not sen. */
  revenue: number;
  commissions: number;
  payouts: number;
  refunds: number;
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  /** Display label, e.g. "Super Admin", "Finance". */
  role: string;
  /** Snake-case action verb, e.g. "adjust_commission". */
  action: string;
  /** Raw target id. */
  target: string;
  targetType: string;
  /** Human-readable target label. */
  targetName: string;
  details: string;
  ip: string;
  /** ISO timestamp. */
  date: string;
}

/** Client-side operations the panel is allowed to record (CSV exports). */
export interface NewAuditEvent {
  action: 'export_payout' | 'export_report';
  targetId?: string;
  targetName?: string;
  details?: string;
  payload?: Record<string, unknown>;
}

export type ProfileChangeField = 'full_name' | 'phone';
export type ProfileChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ProfileChangeRequest {
  id: string;
  driverId: string;
  driverName: string | null;
  driverEmail: string | null;
  field: ProfileChangeField;
  currentValue: string | null;
  requestedValue: string;
  status: ProfileChangeStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  /** Set only when the value actually reached the account — the cooldown clock. */
  appliedAt: string | null;
  createdAt: string;
}

export const PROFILE_CHANGE_FIELD_LABELS: Record<ProfileChangeField, string> = {
  full_name: 'Full name',
  phone: 'Phone number',
};

export const adminApi = {
  getRiders: () => get<Rider[]>('/riders'),

  createRider: (input: NewRider) => post<Rider>('/riders', input),

  deleteRider: (id: string) => del<{ ok: boolean }>(`/riders/${id}`),

  getDrivers: () => get<Driver[]>('/drivers'),

  getMetricsOverview: () => get<MetricsOverview>('/metrics/overview'),

  getTrips: (limit = 500) => get<Trip[]>(`/trips?limit=${limit}`),

  getLiveTrips: () => get<LiveTrip[]>('/trips/live'),

  updateDriverStatus: (id: string, status: DriverStatus, reason?: string) =>
    post<{ ok: boolean; status: DriverStatus }>(`/drivers/${id}/status`, { status, reason }),

  // ── Driver profile change review ────────────────────────────────────────
  // A driver's name and phone are identity evidence behind their PSV-D and the
  // APAD/JPJ operator record, so a self-service edit lands here as a request
  // and only reaches the account when an admin approves it.
  getProfileChanges: (opts: { driverId?: string; status?: ProfileChangeStatus | 'all' } = {}) => {
    const qs = new URLSearchParams();
    if (opts.driverId) qs.set('driverId', opts.driverId);
    if (opts.status) qs.set('status', opts.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    return get<{ requests: ProfileChangeRequest[]; pendingCount: number }>(
      `/driver-profile-changes${suffix}`,
    );
  },

  getProfileChangeCount: () => get<{ pending: number }>('/driver-profile-changes/count'),

  /** Approving writes the value onto the account and starts its 30-day cooldown. */
  reviewProfileChange: (requestId: string, decision: 'approve' | 'reject', note?: string) =>
    post<{ ok: boolean; request: ProfileChangeRequest }>(
      `/driver-profile-changes/${requestId}/review`,
      { decision, note },
    ),

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
  getSurgeConfig: () => get<SurgeConfig>('/surge/config'),

  updateSurgeConfig: (multiplier: number) =>
    put<{ ok: boolean; config: SurgeConfig }>('/surge/config', { multiplier }),

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

  // ── Support tickets ──────────────────────────────────────────────────────────
  getSupportTickets: () => get<SupportTicketRow[]>('/support'),

  updateSupportStatus: (id: string, status: SupportTicketStatus) =>
    put<{ ok: boolean; ticket: SupportTicketRow }>(`/support/${id}`, { status }),

  // ── Revenue reports ──────────────────────────────────────────────────────────
  getRevenueDaily: (days = 30) => get<RevenueDay[]>(`/revenue/daily?days=${days}`),

  // ── Audit log ────────────────────────────────────────────────────────────────
  getAuditLog: (limit = 500) => get<AuditLogEntry[]>(`/audit?limit=${limit}`),

  /** Record a client-side operation (payout/report CSV export) in the audit trail. */
  logAudit: (event: NewAuditEvent) => post<{ ok: boolean }>('/audit', event),
};
