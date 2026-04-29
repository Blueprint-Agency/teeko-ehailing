// modules/dispatch/service.ts
// Match riders to drivers via persisted offers + Redis ZSET queue.
// Single source of truth for the dispatch domain.
// Routes call into this service; repos stay private to the module.

export const dispatchService = {
  todo: 'Match riders to drivers via persisted offers + Redis ZSET queue.',
};
