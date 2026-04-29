import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: 'validation_failed', issues: err.issues });
  }
  req.log.error({ err }, 'unhandled error');
  const status = err.statusCode ?? 500;
  return reply.code(status).send({
    error: err.code ?? 'internal_error',
    message: status === 500 ? 'internal server error' : err.message,
  });
}
