import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.errors.map((e) => e.message).join(', '),
      });
      return;
    }

    const err = error as Error & { statusCode?: number };
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    reply.status(statusCode).send({
      statusCode,
      error: err.name,
      message: err.message,
    });
  });
});
