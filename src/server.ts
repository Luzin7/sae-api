import apiReference from '@scalar/fastify-api-reference';
import 'dotenv/config';
import Fastify from 'fastify';

import { buildContainer } from './container.js';
import authPlugin from './plugins/auth.plugin.js';
import corsPlugin from './plugins/cors.plugin.js';
import docsPlugin from './plugins/docs.plugin.js';
import rateLimitPlugin from './plugins/rate-limit.plugin.js';
import websocketPlugin from './plugins/websocket.plugin.js';

import { db } from '@infra/db/index.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import authRoutes from './modules/auth/auth.routes.js';
import characterRoutes from './modules/character/character.routes.js';
import chatGateway from './modules/chat/chat.gateway.js';
import diceRoutes from './modules/dice/dice.routes.js';
import gameRoutes from './modules/game/game.routes.js';
import playerRoutes from './modules/player/player.routes.js';
import rulesRoutes from './modules/rules/rules.routes.js';
import sessionRoutes from './modules/session/session.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  registerErrorHandler(app);

  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(docsPlugin);
  await app.register(websocketPlugin);

  const container = buildContainer({ db, app });

  await app.register(authRoutes, { services: container.services.auth });
  await app.register(playerRoutes, {
    prefix: '/players',
    services: container.services.player,
  });
  await app.register(gameRoutes, {
    prefix: '/games',
    services: container.services.game,
  });
  await app.register(characterRoutes, {
    prefix: '/characters',
    services: container.services.character,
  });
  await app.register(diceRoutes, {
    prefix: '/dice',
    services: container.services.dice,
  });
  await app.register(sessionRoutes, {
    prefix: '/games',
    services: container.services.session,
  });

  await app.register(rulesRoutes, {
    skillCatalog: container.repositories.skillCatalog,
  });

  await app.register(chatGateway, {
    services: container.services.chat,
    bus: container.bus,
    verifyWsToken: container.verifyWsToken,
  });

  await app.register(apiReference, {
    routePrefix: '/docs',
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}
