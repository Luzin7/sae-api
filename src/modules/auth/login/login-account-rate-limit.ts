import type { FastifyInstance, FastifyRequest } from 'fastify';
import { LoginRateLimitedError } from '../auth.errors.js';
import { LoginBodySchema } from '../auth.schemas.js';

const LOGIN_ATTEMPTS_PER_ACCOUNT = 10;
const LOGIN_ATTEMPTS_WINDOW = '15 minutes';

function accountKey(request: FastifyRequest): string | undefined {
  const body = LoginBodySchema.safeParse(request.body);
  if (!body.success) return undefined;

  return `login-account:${body.data.name.trim().toLowerCase()}`;
}

export function createLoginAccountRateLimit(app: FastifyInstance) {
  const check = app.createRateLimit({
    max: LOGIN_ATTEMPTS_PER_ACCOUNT,
    timeWindow: LOGIN_ATTEMPTS_WINDOW,
    keyGenerator: (request) => accountKey(request) ?? '',
  });

  return async function loginAccountRateLimit(request: FastifyRequest) {
    if (accountKey(request) === undefined) return;

    const limit = await check(request);
    if (limit.isAllowed || !limit.isExceeded) return;

    throw new LoginRateLimitedError();
  };
}
