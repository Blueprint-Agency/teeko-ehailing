// In-process event bus — modules emit, workers/WS subscribe.
// v0.1: thin EventEmitter wrapper. v1.0: drop in BullMQ for cross-process.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();

export type DomainEvent =
  | { type: 'trip.requested'; tripId: string }
  | { type: 'trip.accepted'; tripId: string; driverId: string }
  | { type: 'trip.completed'; tripId: string }
  | { type: 'trip.cancelled'; tripId: string; reason: string }
  | { type: 'driver.online'; driverId: string }
  | { type: 'driver.offline'; driverId: string }
  | { type: 'document.reviewed'; documentId: string; status: 'approved' | 'rejected' };
