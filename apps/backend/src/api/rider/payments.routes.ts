import type { FastifyInstance } from 'fastify';
import type { PaymentMethod } from '@teeko/shared';

const MOCK_METHODS: PaymentMethod[] = [
  { id: 'cash', kind: 'cash', label: 'Cash', isDefault: true },
  { id: 'tng-001', kind: 'tng', label: "Touch 'n Go eWallet" },
  { id: 'card-001', kind: 'card', label: 'Visa', last4: '4242' },
];

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return MOCK_METHODS;
  });

  app.post<{ Params: { id: string } }>('/:id/default', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params;
    const found = MOCK_METHODS.some((m) => m.id === id);
    if (!found) return reply.code(404).send({ error: 'not_found' });
    return MOCK_METHODS.map((m) => ({ ...m, isDefault: m.id === id }));
  });
}
