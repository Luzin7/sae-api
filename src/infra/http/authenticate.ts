import type { FastifyReply, FastifyRequest } from 'fastify';

interface AuthPayload {
  sub: string;
  name: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' },
    });
    return;
  }

  const payload = request.user as AuthPayload;
  request.playerId = payload.sub;
  request.playerName = payload.name;
}
