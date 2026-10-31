import type { FastifyServerOptions } from 'fastify';

type TrustProxySetting = NonNullable<FastifyServerOptions['trustProxy']>;

const HOP_COUNT_PATTERN = /^\d+$/;

function trustFirstHops(hops: number): TrustProxySetting {
  return (_address: string, hopIndex: number) => hopIndex < hops;
}

export function parseTrustProxy(value: string | undefined): TrustProxySetting {
  const normalized = value?.trim() ?? '';

  if (normalized === '' || normalized === 'false') return false;
  if (normalized === 'true') return true;
  if (HOP_COUNT_PATTERN.test(normalized))
    return trustFirstHops(Number(normalized));

  return normalized;
}
