import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    playerId: string;
    playerName: string;
  }
}
