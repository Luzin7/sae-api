import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';

export default fp(async (app: FastifyInstance) => {
  await app.register(cookie);

  await app.register(jwt, {
    secret: process.env['JWT_SECRET'] ?? '',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });
});
