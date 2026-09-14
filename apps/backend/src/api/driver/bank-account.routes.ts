import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '../../config/db';
import { driverBankAccounts } from '../../db/schema/payments';

// Banks finance can transfer to. The admin payout sheet prints this name
// verbatim, so the driver picks from the list rather than typing it.
const BANKS = [
  'Maybank',
  'CIMB Bank',
  'Public Bank',
  'RHB Bank',
  'Hong Leong Bank',
  'AmBank',
  'Bank Islam',
  'Bank Rakyat',
  'Bank Muamalat',
  'Bank Simpanan Nasional',
  'Affin Bank',
  'Alliance Bank',
  'Agrobank',
  'HSBC Bank Malaysia',
  'OCBC Bank Malaysia',
  'Standard Chartered Malaysia',
  'UOB Malaysia',
  'MBSB Bank',
  'Al Rajhi Bank',
  'Citibank Malaysia',
] as const;

const SaveBody = z.object({
  bankName: z.enum(BANKS),
  accountHolderName: z.string().trim().min(2).max(120),
  // Malaysian account numbers are digits only; lengths vary by bank (10–20).
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{8,20}$/, 'Account number must be 8–20 digits'),
});

/** Never send a full account number back to the app — last 4 is enough to confirm. */
function mask(accountNumber: string) {
  return `••••${accountNumber.slice(-4)}`;
}

type Row = typeof driverBankAccounts.$inferSelect;

function present(row: Row | undefined) {
  return row
    ? {
        bankName: row.bankName,
        accountHolderName: row.accountHolderName,
        accountNumberMasked: mask(row.accountNumber),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}

// Driver payout setup. Teeko pays drivers by bank transfer from the admin
// payout sheet, so the driver supplies their bank details here directly.
export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/bank-account — saved details (masked) + the bank list
  // the app's picker renders, so the two can never drift apart.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });

    const row = await db.query.driverBankAccounts.findFirst({
      where: eq(driverBankAccounts.driverId, req.user.id),
    });
    return { account: present(row), banks: BANKS };
  });

  // PUT /api/v1/driver/bank-account — add or replace the account. The driver
  // re-enters the full number on every change; we only ever store the latest.
  app.put('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });

    const body = SaveBody.parse(req.body);
    const [row] = await db
      .insert(driverBankAccounts)
      .values({ driverId: req.user.id, ...body })
      .onConflictDoUpdate({
        target: driverBankAccounts.driverId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning();

    return { account: present(row), banks: BANKS };
  });
}
