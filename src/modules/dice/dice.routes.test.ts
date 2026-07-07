import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import diceRoutes from './dice.routes.js';

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      character: { findFirst: vi.fn() },
    },
  },
}));

process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(diceRoutes, { prefix: '/dice' });
  return app;
}

function makeToken(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ sub: 'test-player-id', name: 'testplayer' });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /dice/roll', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/dice/roll',
      payload: { attribute: 'cognitive', attrValue: 3, skillBonus: 0 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects request with missing attrValue', async () => {
    const app = await buildTestApp();
    const token = makeToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/dice/roll',
      payload: { attribute: 'cognitive', skillBonus: 0 },
      cookies: { token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with valid payload', async () => {
    const app = await buildTestApp();
    const token = makeToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/dice/roll',
      payload: { attribute: 'cognitive', attrValue: 3, skillBonus: 1, bExp: 2 },
      cookies: { token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { rolls: number[]; result: number; total: number };
    expect(body.rolls).toBeDefined();
    expect(body.result).toBeDefined();
    expect(body.total).toBeDefined();
  });
});
