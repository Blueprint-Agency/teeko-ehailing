import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { auditLog } from '../../db/schema/compliance';
import { users, userRoles } from '../../db/schema/identity';
import { recordAudit } from '../../modules/admin/audit';

// DB role → the label the Audit Log page shows in its Role column. Ordered by
// privilege so a user holding several admin roles resolves to the highest one.
const ROLE_LABELS: Array<[string, string]> = [
  ['admin_super', 'Super Admin'],
  ['admin_finance', 'Finance'],
  ['admin_ops', 'Operations'],
  ['admin', 'Admin'],
];
const ADMIN_ROLES = ROLE_LABELS.map(([r]) => r);

function roleLabel(roles: string[]): string {
  for (const [dbRole, label] of ROLE_LABELS) {
    if (roles.includes(dbRole)) return label;
  }
  return 'Admin';
}

// Actions the browser is allowed to self-report via POST /audit. These are
// genuinely client-side operations (a CSV is generated and downloaded in the
// panel), so the server can't observe them any other way. Everything else is
// audited server-side at the mutation and must not be forgeable from the client.
const CLIENT_ACTIONS: Record<string, string> = {
  export_payout: 'payout',
  export_report: 'report',
};

interface AuditPayload {
  targetName?: string | null;
  details?: string | null;
  ip?: string | null;
  [k: string]: unknown;
}

export async function routes(app: FastifyInstance) {
  // ── GET /audit ─────────────────────────────────────────────────────────────
  // Append-only admin action trail, newest first. Resolves each actor to their
  // display name and role for the panel; target name / details / IP come from
  // the row's jsonb payload.
  app.get<{ Querystring: { limit?: string } }>('/', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000);

    const rows = await db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        payload: auditLog.payload,
        occurredAt: auditLog.occurredAt,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.occurredAt))
      .limit(limit);

    // Resolve every distinct actor's name + role in one pass, then stitch.
    const actorIds = [...new Set(rows.map((r) => r.actorId))];
    const actorMap = new Map<string, { name: string; roles: string[] }>();
    if (actorIds.length > 0) {
      const actorRows = await db
        .select({
          id: users.id,
          name: users.fullName,
          role: userRoles.role,
        })
        .from(users)
        .leftJoin(
          userRoles,
          and(eq(userRoles.userId, users.id), inArray(userRoles.role, ADMIN_ROLES as never[])),
        )
        .where(inArray(users.id, actorIds));

      for (const a of actorRows) {
        const entry = actorMap.get(a.id) ?? { name: a.name ?? '—', roles: [] };
        if (a.role) entry.roles.push(a.role);
        actorMap.set(a.id, entry);
      }
    }

    return rows.map((r) => {
      const actor = actorMap.get(r.actorId);
      const payload = (r.payload ?? {}) as AuditPayload;
      return {
        id: String(r.id),
        adminId: r.actorId,
        adminName: actor?.name ?? '—',
        role: roleLabel(actor?.roles ?? []),
        action: r.action,
        target: r.targetId,
        targetType: r.targetType,
        targetName: payload.targetName ?? r.targetId,
        details: payload.details ?? '',
        ip: payload.ip ?? '—',
        date: r.occurredAt.toISOString(),
      };
    });
  });

  // ── POST /audit ────────────────────────────────────────────────────────────
  // Record a client-side operation (CSV exports) into the trail. Restricted to
  // an allowlist so the endpoint can't be used to forge arbitrary audit rows.
  app.post<{
    Body: { action?: string; targetId?: string; targetName?: string; details?: string; payload?: Record<string, unknown> };
  }>('/', async (req, reply) => {
    const { action, targetId, targetName, details, payload } = req.body ?? {};

    if (!action || !(action in CLIENT_ACTIONS)) {
      return reply.code(400).send({ error: 'invalid_action', validActions: Object.keys(CLIENT_ACTIONS) });
    }

    await recordAudit(req, {
      action,
      targetType: CLIENT_ACTIONS[action]!,
      targetId: targetId?.slice(0, 200) || action,
      targetName: targetName?.slice(0, 200) ?? null,
      details: details?.slice(0, 500) ?? null,
      payload,
    });

    return reply.code(201).send({ ok: true });
  });
}
