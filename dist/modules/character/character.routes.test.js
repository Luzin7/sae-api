import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import characterRoutes from './character.routes.js';
vi.mock('../../db/index.js', () => ({
    db: {
        query: {
            character: { findFirst: vi.fn(), findMany: vi.fn() },
            characterItem: { findFirst: vi.fn() },
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
    await app.register(characterRoutes, { prefix: '/characters' });
    return app;
}
function makeToken(app) {
    return app.jwt.sign({ sub: 'test-player-id', name: 'testplayer' });
}
beforeEach(() => vi.clearAllMocks());
describe('POST /characters', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'POST', url: '/characters', payload: {} });
        expect(res.statusCode).toBe(401);
    });
    it('rejects body with missing required fields', async () => {
        const app = await buildTestApp();
        const token = makeToken(app);
        const res = await app.inject({
            method: 'POST',
            url: '/characters',
            payload: { name: 'Hero' },
            cookies: { token },
        });
        expect(res.statusCode).toBe(400);
    });
});
describe('GET /characters/mine', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'GET', url: '/characters/mine' });
        expect(res.statusCode).toBe(401);
    });
});
describe('GET /characters/:id', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'GET', url: '/characters/some-id' });
        expect(res.statusCode).toBe(401);
    });
});
describe('PATCH /characters/:id', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/characters/some-id',
            payload: { name: 'Updated' },
        });
        expect(res.statusCode).toBe(401);
    });
});
describe('DELETE /characters/:id', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({ method: 'DELETE', url: '/characters/some-id' });
        expect(res.statusCode).toBe(401);
    });
});
//# sourceMappingURL=character.routes.test.js.map