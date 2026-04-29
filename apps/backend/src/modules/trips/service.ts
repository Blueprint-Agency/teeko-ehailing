// modules/trips/service.ts
// Lifecycle state machine, append-only event log, cancel + no-show.
// Single source of truth for the trips domain.
// Routes call into this service; repos stay private to the module.

export const tripsService = {
  todo: 'Lifecycle state machine, append-only event log, cancel + no-show.',
};
