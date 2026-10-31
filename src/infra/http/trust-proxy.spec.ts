import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import rateLimitPlugin from '../../plugins/rate-limit.plugin.js';
import { parseTrustProxy } from './trust-proxy.js';

const RENDER_PROXY = '10.0.0.1';
const VERCEL_EDGE = '76.76.21.1';

async function buildProbeApp(trustProxy: string | undefined) {
  const app = Fastify({ trustProxy: parseTrustProxy(trustProxy) });
  await app.register(rateLimitPlugin);
  app.get('/ip', async (request) => ({ ip: request.ip }));
  return app;
}

function requestFrom(
  app: Awaited<ReturnType<typeof buildProbeApp>>,
  forwardedFor: string,
) {
  return app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress: RENDER_PROXY,
    headers: { 'x-forwarded-for': forwardedFor },
  });
}

describe('parseTrustProxy', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
    ['10.0.0.0/8', '10.0.0.0/8'],
  ])('converte %s', (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });
});

describe('request.ip atras do proxy', () => {
  it('sem TRUST_PROXY ignora x-forwarded-for', async () => {
    const app = await buildProbeApp(undefined);
    const response = await requestFrom(app, `203.0.113.7, ${VERCEL_EDGE}`);

    expect(response.json().ip).toBe(RENDER_PROXY);
  });

  it('com TRUST_PROXY=2 resolve o IP do cliente', async () => {
    const app = await buildProbeApp('2');
    const response = await requestFrom(app, `203.0.113.7, ${VERCEL_EDGE}`);

    expect(response.json().ip).toBe('203.0.113.7');
  });

  it('cliente nao forja o IP com x-forwarded-for proprio', async () => {
    const app = await buildProbeApp('2');
    const response = await requestFrom(
      app,
      `6.6.6.6, 203.0.113.7, ${VERCEL_EDGE}`,
    );

    expect(response.json().ip).toBe('203.0.113.7');
  });

  it('rate limit separa baldes por cliente', async () => {
    const app = await buildProbeApp('2');
    for (let i = 0; i < 100; i++)
      await requestFrom(app, `203.0.113.7, ${VERCEL_EDGE}`);

    const sameClient = await requestFrom(app, `203.0.113.7, ${VERCEL_EDGE}`);
    const otherClient = await requestFrom(app, `198.51.100.9, ${VERCEL_EDGE}`);

    expect(sameClient.statusCode).toBe(429);
    expect(otherClient.statusCode).toBe(200);
  });
});
