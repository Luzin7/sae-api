import ws from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { WS_MAX_FRAME_BYTES } from '@infra/ws/config.js';

export default fp(async (app: FastifyInstance) => {
  await app.register(ws, {
    options: { maxPayload: WS_MAX_FRAME_BYTES },
  });
});
