// client/support.ts
// Rider general support tickets. Mirrors the backend rider support routes
// (apps/backend/src/api/rider/support.routes.ts).

import type { CreateSupportTicketInput, SupportTicket } from '@teeko/shared';

import { api } from './_fetch';

export async function create(input: CreateSupportTicketInput): Promise<SupportTicket> {
  return api<SupportTicket>('/api/v1/rider/support', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Every support ticket the signed-in rider has raised. */
export async function listAll(): Promise<SupportTicket[]> {
  return api<SupportTicket[]>('/api/v1/rider/support');
}
