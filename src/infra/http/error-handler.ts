import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '@shared/errors/domain-error.js';

function formatValidationError(error: ZodError): string {
  const details = error.errors
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}: ${issue.message}`
        : issue.message,
    )
    .join('; ');

  return details.length > 0 ? `Dados inválidos: ${details}` : 'Dados inválidos.';
}

/**
 * Stable envelope codes for transport-level client errors (Fastify parser,
 * payload size, etc.). DomainError codes are not reused here because those
 * carry domain meaning; `BAD_REQUEST` is the fallback for the rest.
 */
const CLIENT_ERROR_CODES: Record<number, string> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION',
};

function isClientError(
  error: unknown,
): error is { statusCode: number; message: string } {
  if (typeof error !== 'object' || error === null) return false;
  if (!('statusCode' in error)) return false;

  const { statusCode } = error as { statusCode?: unknown };
  if (typeof statusCode !== 'number') return false;

  return statusCode >= 400 && statusCode <= 499;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: formatValidationError(error) },
      });
    }

    if (error instanceof DomainError) {
      return reply.status(error.httpStatus).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (isClientError(error)) {
      return reply.status(error.statusCode).send({
        error: {
          code: CLIENT_ERROR_CODES[error.statusCode] ?? 'BAD_REQUEST',
          message: error.message,
        },
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Erro interno do servidor.' },
    });
  });
}
