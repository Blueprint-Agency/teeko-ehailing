// BullMQ worker process bootstrap.
// Wired in v1.0 — for now this just keeps the process alive so `make worker` works.
import { logger } from './config/logger';

logger.info('teeko-worker boot · stub · register BullMQ workers in src/jobs/*');

// Keep the process alive so tsx watch doesn't exit immediately.
setInterval(() => {}, 1 << 30);
