import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../../http/middleware/requireRole';
import { pdpaService } from '../../modules/pdpa/service';
import { recordAuditSafe } from '../../modules/admin/audit';
import { DomainError } from '../../shared/errors';

const CreateDsr = z.object({
  userId: z.string().uuid(),
  kind: z.enum(['access', 'erasure', 'correction']),
});
const StatusBody = z.object({ status: z.enum(['received', 'processing', 'denied']) });
const WithdrawBody = z.object({
  userId: z.string().uuid(),
  consentType: z.enum(['tnc', 'driver_agreement', 'pdpa', 'marketing']),
});

function handleDomain(err: unknown, reply: import('fastify').FastifyReply) {
  if (err instanceof DomainError) {
    return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
  }
  throw err;
}

export async function routes(app: FastifyInstance) {
  // PDPA tooling is Super-Admin only (mirrors the page's `pdpa_tools` gate).
  app.addHook('preHandler', requireRole('admin_super'));

  // ── Data Subject Requests ────────────────────────────────────────────────────
  app.get('/dsr', async () => pdpaService.listDsrs());

  app.post('/dsr', async (req, reply) => {
    const body = CreateDsr.parse(req.body);
    try {
      const dsr = await pdpaService.createDsr(body.userId, body.kind);
      await recordAuditSafe(req, {
        action: 'pdpa_dsr_created',
        targetType: 'data_subject_request',
        targetId: dsr.id,
        targetName: dsr.name,
        details: `${body.kind} request logged`,
        payload: { userId: body.userId, kind: body.kind },
      });
      return reply.code(201).send(dsr);
    } catch (err) {
      return handleDomain(err, reply);
    }
  });

  app.post<{ Params: { id: string } }>('/dsr/:id/status', async (req, reply) => {
    const { status } = StatusBody.parse(req.body);
    try {
      const dsr = await pdpaService.setDsrStatus(req.params.id, status);
      await recordAuditSafe(req, {
        action: 'pdpa_dsr_status',
        targetType: 'data_subject_request',
        targetId: dsr.id,
        targetName: dsr.name,
        details: `Status → ${status}`,
        payload: { status },
      });
      return { ok: true, dsr };
    } catch (err) {
      return handleDomain(err, reply);
    }
  });

  // Kind-dispatched fulfilment: access → export, erasure → anonymise.
  app.post<{ Params: { id: string } }>('/dsr/:id/fulfil', async (req, reply) => {
    try {
      const dsr = await pdpaService.setDsrStatus(req.params.id, 'processing');
      if (dsr.kind === 'access') {
        const out = await pdpaService.fulfilAccess(dsr.id);
        await recordAuditSafe(req, {
          action: 'pdpa_access_export',
          targetType: 'data_subject_request',
          targetId: dsr.id,
          targetName: dsr.name,
          details: 'SAR export generated',
          payload: { userId: dsr.userId, path: out.path },
        });
        return { ok: true, kind: 'access', export: out };
      }
      if (dsr.kind === 'erasure') {
        const report = await pdpaService.executeErasure(dsr.userId);
        const done = await pdpaService.setDsrStatus(dsr.id, 'fulfilled');
        await recordAuditSafe(req, {
          action: 'pdpa_erasure',
          targetType: 'user',
          targetId: dsr.userId,
          targetName: dsr.name,
          details: 'Account anonymised (retention-aware)',
          payload: report,
        });
        return { ok: true, kind: 'erasure', report, dsr: done };
      }
      // correction — fulfilment is a manual data edit; close the request.
      const done = await pdpaService.setDsrStatus(dsr.id, 'fulfilled');
      await recordAuditSafe(req, {
        action: 'pdpa_correction_ack',
        targetType: 'data_subject_request',
        targetId: dsr.id,
        targetName: dsr.name,
        details: 'Correction request fulfilled',
      });
      return { ok: true, kind: 'correction', dsr: done };
    } catch (err) {
      return handleDomain(err, reply);
    }
  });

  // ── Ad-hoc access export (not tied to a DSR) ─────────────────────────────────
  app.get<{ Params: { id: string } }>('/users/:id/export', async (req, reply) => {
    try {
      const data = await pdpaService.buildAccessExport(req.params.id);
      await recordAuditSafe(req, {
        action: 'pdpa_access_export',
        targetType: 'user',
        targetId: req.params.id,
        details: 'Ad-hoc SAR export',
      });
      return data;
    } catch (err) {
      return handleDomain(err, reply);
    }
  });

  // ── Ad-hoc erasure (not tied to a DSR) ───────────────────────────────────────
  app.post<{ Params: { id: string } }>('/users/:id/erasure', async (req, reply) => {
    try {
      const report = await pdpaService.executeErasure(req.params.id);
      await recordAuditSafe(req, {
        action: 'pdpa_erasure',
        targetType: 'user',
        targetId: req.params.id,
        details: 'Account anonymised (retention-aware)',
        payload: report,
      });
      return { ok: true, report };
    } catch (err) {
      return handleDomain(err, reply);
    }
  });

  // ── Consent ──────────────────────────────────────────────────────────────────
  app.get<{ Querystring: { userId?: string } }>('/consent', async (req) =>
    pdpaService.listConsents(req.query.userId),
  );

  app.post('/consent/withdraw', async (req, reply) => {
    const body = WithdrawBody.parse(req.body);
    try {
      const row = await pdpaService.withdrawConsent(body.userId, body.consentType);
      await recordAuditSafe(req, {
        action: 'pdpa_consent_withdrawn',
        targetType: 'user',
        targetId: body.userId,
        details: `Consent withdrawn: ${body.consentType}`,
        payload: { consentType: body.consentType },
      });
      return { ok: true, consent: row };
    } catch (err) {
      return handleDomain(err, reply);
    }
  });
}
