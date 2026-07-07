import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import authRoutes from './auth.routes.js';
vi.mock('../../db/index.js', () => ({
    db: {
        query: {
            player: { findFirst: vi.fn() },
            refreshToken: { findFirst: vi.fn() },
        },
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
    },
}));
process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';
async function buildTestApp() {
    const app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(errorHandlerPlugin);
    await app.register(authRoutes);
    return app;
}
beforeEach(() => vi.clearAllMocks());
describe('POST /auth/register', () => {
    it('rejects name shorter than 3 characters', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'ab', password: 'validpassword' },
        });
        expect(res.statusCode).toBe(400);
    });
    it('rejects password shorter than 8 characters', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'validname', password: 'short' },
        });
        expect(res.statusCode).toBe(400);
    });
});
describe('POST /auth/login', () => {
    it('rejects empty body', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: {},
        });
        expect(res.statusCode).toBe(400);
    });
});
describe('POST /auth/logout', () => {
    it('returns 401 without authentication', async () => {
        const app = await buildTestApp();
        const res = await app.inject({
            method: 'POST',
            url: '/auth/logout',
        });
        expect(res.statusCode).toBe(401);
    });
});
//# sourceMappingURL=auth.routes.test.js.map