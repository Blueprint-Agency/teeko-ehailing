import type { FastifyInstance } from 'fastify';
import { payoutsService, type EarningsPeriod } from '../../modules/payouts/service';

const PERIODS: EarningsPeriod[] = ['day', 'week', 'month'];

export async function routes(app: FastifyInstance) {
  // Earnings dashboard — totals for the selected window plus the one before it,
  // chart buckets, recent trips, and payout history. Earnings are paid out to
  // the driver's registered bank account on the payout cycle, so there is no
  // in-app cashout to expose here.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    // An unrecognised value falls back to the week view rather than erroring —
    // the dashboard is a read, and a bad query string shouldn't blank it.
    const raw = (req.query as { period?: string } | undefined)?.period;
    const period = PERIODS.find((p) => p === raw) ?? 'week';
    return payoutsService.getEarnings(req.user.id, period);
  });
}
