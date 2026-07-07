import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import gameRoutes from './game.routes.js';
vi.mock('../../db/index.js', () => ({
    db: {
        query: {
            game: { findFirst: vi.fn(), findMany: vi.fn() },
            playerGame: { findFirst: vi.fn(), findMany: vi.fn() },
        },
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
    },
}));
process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';
async function buildTestApp() {
    const app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(errorHandlerPlugin);
    await app.register(gameRoutes, { prefix: '/games' });
    return app;
}
function makeToken(app) {
    return app.jwt.sign({ sub: 'test-player-id', name: 'testplayer' });
}
beforeEach(() => vi.clearAllMocks());
describe('POST /games', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/games',
            payload: { name: 'My Campaign' },
        });
        expect(res.statusCode).toBe(401);
    });
    it('rejects request with missing name', async () => {
        const app = await buildTestApp();
        const token = makeToken(app);
        const res = await app.inject({
            method: 'POST',
            url: '/games',
            payload: {},
            cookies: { token },
        });
        expect(res.statusCode).toBe(400);
    });
});
describe('GET /games/mine', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'GET', url: '/games/mine' });
        expect(res.statusCode).toBe(401);
    });
});
describe('POST /games/join', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/games/join',
            payload: { inviteCode: 'ABC123' },
        });
        expect(res.statusCode).toBe(401);
    });
});
describe('PATCH /games/:id', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/games/some-game-id',
            payload: { name: 'New Name' },
        });
        expect(res.statusCode).toBe(401);
    });
});
describe('DELETE /games/:id', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'DELETE', url: '/games/some-game-id' });
        expect(res.statusCode).toBe(401);
    });
});
//# sourceMappingURL=game.routes.test.js.map