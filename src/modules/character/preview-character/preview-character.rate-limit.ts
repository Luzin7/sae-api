import type { FastifyRequest } from 'fastify';
import { PreviewRateLimitedError } from '../character.errors.js';

const PREVIEW_MAX_REQUESTS = 60;
const PREVIEW_WINDOW = '1 minute';

async function previewRateLimitKey(request: FastifyRequest): Promise<string> {
  try {
    const payload = await request.jwtVerify<{ sub: string }>();

    return `player:${payload.sub}`;
  } catch {
    return `ip:${request.ip}`;
  }
}

export const previewRateLimit = {
  max: PREVIEW_MAX_REQUESTS,
  timeWindow: PREVIEW_WINDOW,
  keyGenerator: previewRateLimitKey,
  errorResponseBuilder: () => new PreviewRateLimitedError(),
};
