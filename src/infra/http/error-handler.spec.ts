import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConflictError } from '@shared/errors/http-errors.js';
import { registerErrorHandler } from './error-handler.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  app.post('/domain', async () => {
    throw new ConflictError('conflito');
  });
  app.post('/validation', async () => {
    z.object({ a: z.string() }).parse({});
  });
  app.post('/boom', async () => {
    throw new Error('boom');
  });

  return app;
}

describe('registerErrorHandler', () => {
  it('maps a DomainError to its status and envelope', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/domain' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: { code: 'CONFLICT', message: 'conflito' },
    });
  });

  it('maps a ZodError to a 400 VALIDATION envelope', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/validation' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('passes a Fastify 4xx client error through instead of masking it as 500', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/domain',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('returns 500 INTERNAL for unexpected errors', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL', message: 'Erro interno do servidor.' },
    });
  });
});