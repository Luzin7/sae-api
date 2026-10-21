declare module 'fastify' {
  interface FastifyRequest {
    playerId: string;
    playerName: string;
  }
}

export {};
