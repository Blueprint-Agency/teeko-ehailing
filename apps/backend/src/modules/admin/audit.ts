// modules/admin/audit.ts
// Append-only admin audit trail. Every "big" back-office operation — driver
// status changes, commission/surge edits, dispute resolutions, payout/report
// exports, admin lifecycle — writes one row here so the Audit Log page (and any
// future APAD/JPJ compliance export) has a tamper-evident record of who did
// what, to whom, and from where.
//
// The `audit_log` table stays deliberately generic (actor/action/target/payload).
// Human-facing extras the panel renders — a resolved target name, a one-line
// summary, and the caller's IP — live inside the jsonb `payload` so no schema
// migration is needed as we add new audited actions.

import type { FastifyRequest } from 'fastify';
import { db as rootDb, type Db } from '../../config/db';
import { auditLog } from '../../db/schema/compliance';

// Both the root `db` and a `tx` handed out by `db.transaction` expose `.insert`
// with the same signature, so either can satisfy an audit write.
type Executor = Pick<Db, 'insert'>;

export interface AuditEntry {
  /** Snake-case verb, e.g. `driver_status_change`, `adjust_commission`. */
  action: string;
  /** Coarse category of the target, e.g. `driver`, `surge_zone`, `dispute`. */
  targetType: string;
  /** Stable id of the affected entity (uuid, zone id, category key, …). */
  targetId: string;
  /** Human-readable label for the target, shown in the panel's Target column. */
  targetName?: string | null;
  /** One-line summary of what changed, shown in the Details column. */
  details?: string | null;
  /** Extra structured context (old/new values, reasons, amounts). */
  payload?: Record<string, unknown>;
}

/** Best-effort client IP: honour a proxy's X-Forwarded-For, else the socket. */
function clientIp(req: FastifyRequest): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(',')[0]!.trim();
  return req.ip ?? null;
}

/**
 * Write one audit row. Pass a transaction `exec` to make the audit atomic with
 * the operation it records; omit it to write on the root connection.
 *
 * Throws if the insert fails — use inside a transaction where you *want* a
 * failed audit to roll the operation back, or wrap with `recordAuditSafe` when
 * the operation must succeed regardless.
 */
export async function recordAudit(
  req: FastifyRequest,
  entry: AuditEntry,
  exec: Executor = rootDb,
): Promise<void> {
  const actorId = req.user?.id;
  if (!actorId) {
    req.log.warn({ action: entry.action }, 'recordAudit: no authenticated actor; skipping');
    return;
  }

  const payload = {
    ...(entry.payload ?? {}),
    targetName: entry.targetName ?? null,
    details: entry.details ?? null,
    ip: clientIp(req),
  };

  await exec.insert(auditLog).values({
    actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    payload,
  });
}

/**
 * Fire-and-forget audit write for operations already committed. Never throws:
 * an audit failure is logged but must not fail the user's request or undo an
 * already-persisted change.
 */
export async function recordAuditSafe(req: FastifyRequest, entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(req, entry);
  } catch (err) {
    req.log.error({ err, action: entry.action, targetId: entry.targetId }, 'audit write failed');
  }
}
