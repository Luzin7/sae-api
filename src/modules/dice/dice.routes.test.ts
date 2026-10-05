import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import type { Rng } from '@shared/dice/roll.js';
import diceRoutes from './dice.routes.js';
import { RollService } from './roll/roll.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

const fixedRng: Rng = (min, max) => max;

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(diceRoutes, {
    prefix: '/dice',
    services: { roll: new RollService(fixedRng) },
  });
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

  it('rejects attrValue -1 and 0 (out of the attribute scale)', async () => {
    const app = await buildTestApp();
    const token = makeToken(app);

    for (const attrValue of [-1, 0]) {
      const res = await app.inject({
        method: 'POST',
        url: '/dice/roll',
        payload: { attribute: 'cognitive', attrValue, skillBonus: 0 },
        cookies: { token },
      });
      expect(res.statusCode).toBe(400);
    }
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
    const body = JSON.parse(res.body) as {
      rolls: number[];
      result: number;
      total: number;
    };
    expect(body.rolls).toBeDefined();
    expect(body.result).toBeDefined();
    expect(body.total).toBeDefined();
  });
});
