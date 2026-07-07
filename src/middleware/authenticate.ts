import type { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as { sub: string; name: string };
    request.playerId = payload.sub;
    request.playerName = payload.name;
  } catch {
    reply.status(401).send({ message: 'Unauthorized' });
  }
}
