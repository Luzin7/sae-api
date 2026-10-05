import type { FastifyReply } from 'fastify';

const ACCESS_COOKIE = 'token';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type CookiePolicy = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
};

function cookiePolicy(): CookiePolicy {
  const secure = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(ACCESS_COOKIE, token, cookiePolicy());
}

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    ...cookiePolicy(),
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}
