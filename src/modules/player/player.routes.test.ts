import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import { GetMeService } from './get-me/get-me.service.js';
import { GetPlayerService } from './get-player/get-player.service.js';
import type { PlayerRepository } from './player.repository.js';
import playerRoutes, { type PlayerServices } from './player.routes.js';
import { UpdateMeService } from './update-me/update-me.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

function makePlayerRepository(): PlayerRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
  };
}

function makeServices(players: PlayerRepository): PlayerServices {
  return {
    getMe: new GetMeService(players),
    getPlayer: new GetPlayerService(players),
    updateMe: new UpdateMeService(players),
  };
}

async function buildTestApp(services: PlayerServices) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(playerRoutes, { prefix: '/players', services });
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('player routes', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp(makeServices(makePlayerRepository()));

    const res = await app.inject({ method: 'GET', url: '/players/me' });

    expect(res.statusCode).toBe(401);
  });
});
