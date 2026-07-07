import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
export default fp(async (app) => {
    await app.register(cookie);
    await app.register(jwt, {
        secret: process.env['JWT_SECRET'] ?? '',
        cookie: {
            cookieName: 'token',
            signed: false,
        },
    });
});
//# sourceMappingURL=auth.plugin.js.map