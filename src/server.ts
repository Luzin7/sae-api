import 'dotenv/config';
import Fastify from 'fastify';
import apiReference from '@scalar/fastify-api-reference';

import authPlugin from './plugins/auth.plugin.js';
import corsPlugin from './plugins/cors.plugin.js';
import docsPlugin from './plugins/docs.plugin.js';
import rateLimitPlugin from './plugins/rate-limit.plugin.js';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';

import authRoutes from './modules/auth/auth.routes.js';
import playerRoutes from './modules/player/player.routes.js';
import gameRoutes from './modules/game/game.routes.js';
import characterRoutes from './modules/character/character.routes.js';
import diceRoutes from './modules/dice/dice.routes.js';
import sessionRoutes from './modules/session/session.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(docsPlugin);

  await app.register(authRoutes);
  await app.register(playerRoutes, { prefix: '/players' });
  await app.register(gameRoutes, { prefix: '/games' });
  await app.register(characterRoutes, { prefix: '/characters' });
  await app.register(diceRoutes, { prefix: '/dice' });
  await app.register(sessionRoutes, { prefix: '/games' });

  await app.register(apiReference, {
    routePrefix: '/docs',
  });

  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  const app = await buildApp();
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}
