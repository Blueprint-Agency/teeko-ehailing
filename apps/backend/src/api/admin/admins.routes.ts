import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import { requireRole } from '../../http/middleware/requireRole';

// UI role vocabulary — collapsed to two roles for now:
//  · super_admin — can do anything, including deactivating other admins
//  · admin       — can do anything except deactivate other admins
type UiRole = 'super_admin' | 'admin';

// Every DB role that grants back-office access. `admin_ops`/`admin_finance` are
// legacy values kept so pre-existing accounts still surface; they read as
// generic "admin" in the two-role model.
const ADMIN_DB_ROLES = ['admin_super', 'admin', 'admin_ops', 'admin_finance'] as const;

function toUiRole(dbRole: string): UiRole {
  return dbRole === 'admin_super' ? 'super_admin' : 'admin';
}

function toDbRole(uiRole: UiRole): 'admin_super' | 'admin' {
  return uiRole === 'super_admin' ? 'admin_super' : 'admin';
}

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: UiRole;
  status: string;
  // No login tracking yet — always null; the admin panel renders it as "—".
  lastLogin: string | null;
  createdAt: string | null;
};

export async function routes(app: FastifyInstance) {
  // List all admin users, super admins first, then newest.
  app.get('/', async () => {
    const rows = await db
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        role: userRoles.role,
      })
      .from(users)
      .innerJoin(
        userRoles,
        and(eq(userRoles.userId, users.id), inArray(userRoles.role, [...ADMIN_DB_ROLES])),
      )
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.createdAt));

    const mapped = rows.map<AdminRow>((r) => ({
      id: r.id,
      name: r.name ?? '—',
      email: r.email ?? '—',
      role: toUiRole(r.role),
      // `deactivated` reads better as "inactive" in the admin chip palette.
      status: r.status === 'deactivated' ? 'inactive' : r.status,
      lastLogin: null,
      createdAt: r.createdAt ? r.createdAt.toISOString().slice(0, 10) : null,
    }));

    // Super admins on top, then by most-recent join date.
    return mapped.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'super_admin' ? -1 : 1;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  });

  // Create an admin user — provisions a user row plus its admin role.
  app.post<{ Body: { name?: string; email?: string; role?: UiRole } }>(
    '/',
    async (req, reply) => {
      const name = req.body?.name?.trim();
      const email = req.body?.email?.trim() || null;
      const uiRole: UiRole = req.body?.role === 'super_admin' ? 'super_admin' : 'admin';

      if (!name) return reply.code(400).send({ error: 'name_required' });
      if (!email) return reply.code(400).send({ error: 'email_required' });

      const admin = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ fullName: name, email })
          .returning({ id: users.id, createdAt: users.createdAt });
        if (!user) throw new Error('insert users returned no row');

        await tx.insert(userRoles).values({ userId: user.id, role: toDbRole(uiRole) });
        return user;
      });

      const body: AdminRow = {
        id: admin.id,
        name,
        email: email ?? '—',
        role: uiRole,
        status: 'active',
        lastLogin: null,
        createdAt: admin.createdAt ? admin.createdAt.toISOString().slice(0, 10) : null,
      };
      return reply.code(201).send(body);
    },
  );

  // Deactivate an admin — restricted to super admins; super-admin accounts
  // themselves cannot be deactivated through the panel.
  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    { preHandler: requireRole('admin_super') },
    async (req, reply) => {
      const { id } = req.params;

      const [target] = await db
        .select({ id: users.id, role: userRoles.role })
        .from(users)
        .innerJoin(
          userRoles,
          and(eq(userRoles.userId, users.id), inArray(userRoles.role, [...ADMIN_DB_ROLES])),
        )
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);
      if (!target) return reply.code(404).send({ error: 'admin_not_found' });
      if (target.role === 'admin_super') {
        return reply.code(403).send({ error: 'cannot_deactivate_super_admin' });
      }

      await db.update(users).set({ status: 'deactivated' }).where(eq(users.id, id));

      return reply.send({ ok: true });
    },
  );
}
