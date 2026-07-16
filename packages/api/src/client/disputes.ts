// client/disputes.ts
// Rider trip disputes. Mirrors the backend rider disputes routes
// (apps/backend/src/api/rider/disputes.routes.ts).

import type { CreateDisputeInput, RiderDispute } from '@teeko/shared';

import { api } from './_fetch';

export async function create(input: CreateDisputeInput): Promise<RiderDispute> {
  return api<RiderDispute>('/api/v1/rider/disputes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listForTrip(tripId: string): Promise<RiderDispute[]> {
  return api<RiderDispute[]>(
    `/api/v1/rider/disputes?tripId=${encodeURIComponent(tripId)}`,
  );
}
