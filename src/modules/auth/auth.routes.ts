import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import {
  clearAuthCookies,
  setAuthCookie,
  setRefreshCookie,
} from '@infra/http/auth-cookies.js';
import { LoginBodySchema, RegisterBodySchema } from './auth.schemas.js';
import type { LoginService } from './login/login.service.js';
import type { LogoutService } from './logout/logout.service.js';
import type { RefreshService } from './refresh/refresh.service.js';
import type { RegisterService } from './register/register.service.js';
import type { WsTokenService } from './ws-token/ws-token.service.js';

export interface AuthServices {
  register: RegisterService;
  login: LoginService;
  refresh: RefreshService;
  logout: LogoutService;
  wsToken: WsTokenService;
}

export interface AuthRoutesOptions {
  services: AuthServices;
}

const AUTH_RATE_LIMIT = {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
};

export default async function authRoutes(
  app: FastifyInstance,
  opts: AuthRoutesOptions,
) {
  app.post('/auth/register', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = RegisterBodySchema.parse(request.body);
    const result = await opts.services.register.execute(body);

    setAuthCookie(reply, result.accessToken);
    setRefreshCookie(reply, result.refreshToken);

    return reply.status(201).send({ player: result.player });
  });

  app.post('/auth/login', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = LoginBodySchema.parse(request.body);
    const result = await opts.services.login.execute(body);

    setAuthCookie(reply, result.accessToken);
    setRefreshCookie(reply, result.refreshToken);

    return reply.send({ player: result.player });
  });

  app.post(
    '/auth/logout',
    { preHandler: authenticate },
    async (request, reply) => {
      await opts.services.logout.execute(request.playerId);
      clearAuthCookies(reply);

      return reply.send({ ok: true });
    },
  );

  app.post('/auth/refresh', AUTH_RATE_LIMIT, async (request, reply) => {
    const presented = request.cookies['refresh_token'] ?? '';
    const result = await opts.services.refresh.execute(presented);

    setAuthCookie(reply, result.accessToken);
    setRefreshCookie(reply, result.refreshToken);

    return reply.send({ ok: true });
  });

  app.get(
    '/auth/ws-token',
    { preHandler: authenticate },
    async (request) => {
      return { token: opts.services.wsToken.execute(request.playerId) };
    },
  );
}
