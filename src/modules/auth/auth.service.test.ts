import { describe, expect, it, vi } from 'vitest';
import {
  InvalidCredentialsError,
  RefreshTokenReusedError,
  SessionExpiredError,
  SessionRevokedError,
  UsernameTakenError,
} from './auth.errors.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
} from './auth.repository.js';
import { LoginService } from './login/login.service.js';
import { LogoutService } from './logout/logout.service.js';
import {
  REFRESH_GRACE_WINDOW_MS,
  RefreshService,
} from './refresh/refresh.service.js';
import { RegisterService } from './register/register.service.js';
import { WsTokenService } from './ws-token/ws-token.service.js';

function makeCredentialsRepository(): CredentialsRepository {
  return {
    findByUsername: vi.fn(),
    create: vi.fn(),
  };
}

function makeSessionsRepository(): AuthSessionRepository {
  return {
    create: vi.fn(),
    rotate: vi.fn(),
    deleteByPlayerId: vi.fn(),
  };
}

function makeRefreshTokens() {
  return {
    generate: vi.fn().mockReturnValue('refresh-token'),
    hash: vi.fn((token: string) => `hash:${token}`),
  };
}

describe('RegisterService', () => {
  function makeSubject() {
    const credentials = makeCredentialsRepository();
    const sessions = makeSessionsRepository();
    const sign = vi.fn().mockReturnValue('access-token');
    const passwords = {
      hash: vi.fn().mockResolvedValue('password-hash'),
      verify: vi.fn(),
    };
    const refreshTokens = makeRefreshTokens();

    const service = new RegisterService(
      credentials,
      sessions,
      { sign },
      passwords,
      refreshTokens,
    );

    return { service, credentials, sessions, passwords, refreshTokens };
  }

  it('throws UsernameTakenError when the name is taken', async () => {
    const { service, credentials, sessions } = makeSubject();
    vi.mocked(credentials.findByUsername).mockResolvedValue({
      id: 'taken-id',
      name: 'Taken',
      passwordHash: 'hash',
    });

    await expect(
      service.execute({ name: 'Taken', password: 'secret123' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('hashes the password and opens a refresh session', async () => {
    const { service, credentials, sessions, passwords } = makeSubject();
    vi.mocked(credentials.findByUsername).mockResolvedValue(null);
    vi.mocked(credentials.create).mockResolvedValue({
      id: 'player-1',
      name: 'Alice',
    });

    const result = await service.execute({
      name: 'Alice',
      password: 'secret123',
    });

    expect(passwords.hash).toHaveBeenCalledWith('secret123');
    expect(credentials.create).toHaveBeenCalledWith({
      name: 'Alice',
      passwordHash: 'password-hash',
    });
    expect(sessions.create).toHaveBeenCalledWith({
      playerId: 'player-1',
      tokenHash: 'hash:refresh-token',
      expiresAt: expect.any(Date),
    });
    expect(result).toEqual({
      player: { id: 'player-1', name: 'Alice' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });
});

describe('LoginService', () => {
  function makeSubject() {
    const credentials = makeCredentialsRepository();
    const sessions = makeSessionsRepository();
    const sign = vi.fn().mockReturnValue('access-token');
    const passwords = {
      hash: vi.fn(),
      verify: vi.fn(),
    };
    const refreshTokens = makeRefreshTokens();

    const service = new LoginService(
      credentials,
      sessions,
      { sign },
      passwords,
      refreshTokens,
    );

    return { service, credentials, sessions, passwords };
  }

  it('throws the generic error when the user does not exist', async () => {
    const { service, credentials } = makeSubject();
    vi.mocked(credentials.findByUsername).mockResolvedValue(null);

    await expect(
      service.execute({ name: 'nobody', password: 'secret123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws the same generic error when the password is wrong', async () => {
    const { service, credentials, passwords } = makeSubject();
    vi.mocked(credentials.findByUsername).mockResolvedValue({
      id: 'player-1',
      name: 'Alice',
      passwordHash: 'hash',
    });
    vi.mocked(passwords.verify).mockResolvedValue(false);

    await expect(
      service.execute({ name: 'Alice', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('returns tokens and opens a refresh session on success', async () => {
    const { service, credentials, sessions, passwords } = makeSubject();
    vi.mocked(credentials.findByUsername).mockResolvedValue({
      id: 'player-1',
      name: 'Alice',
      passwordHash: 'hash',
    });
    vi.mocked(passwords.verify).mockResolvedValue(true);

    const result = await service.execute({
      name: 'Alice',
      password: 'secret123',
    });

    expect(sessions.create).toHaveBeenCalledWith({
      playerId: 'player-1',
      tokenHash: 'hash:refresh-token',
      expiresAt: expect.any(Date),
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.player).toEqual({ id: 'player-1', name: 'Alice' });
  });
});

describe('RefreshService', () => {
  function makeSubject() {
    const sessions = makeSessionsRepository();
    const sign = vi.fn().mockReturnValue('new-access-token');
    const refreshTokens = {
      generate: vi.fn().mockReturnValue('new-refresh-token'),
      hash: vi.fn((token: string) => `hash:${token}`),
    };

    const service = new RefreshService(sessions, { sign }, refreshTokens);

    return { service, sessions, refreshTokens };
  }

  it.each([
    ['unknown', SessionExpiredError],
    ['expired', SessionExpiredError],
    ['revoked', SessionRevokedError],
    ['reused', RefreshTokenReusedError],
  ] as const)('maps a %s token to its named error', async (status, error) => {
    const { service, sessions } = makeSubject();
    vi.mocked(sessions.rotate).mockResolvedValue({ status });

    await expect(service.execute('presented')).rejects.toBeInstanceOf(error);
  });

  it('rejects an empty token without touching the repository', async () => {
    const { service, sessions } = makeSubject();

    await expect(service.execute('')).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(sessions.rotate).not.toHaveBeenCalled();
  });

  it('rotates through the repository and signs a new access token', async () => {
    const { service, sessions } = makeSubject();
    vi.mocked(sessions.rotate).mockResolvedValue({
      status: 'issued',
      playerId: 'player-1',
      name: 'Alice',
    });

    const result = await service.execute('old-token');

    expect(sessions.rotate).toHaveBeenCalledWith({
      presentedHash: 'hash:old-token',
      successorHash: 'hash:new-refresh-token',
      successorExpiresAt: expect.any(Date),
      now: expect.any(Date),
      graceWindowMs: REFRESH_GRACE_WINDOW_MS,
    });
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });
});

describe('LogoutService', () => {
  it('revokes every session for the player', async () => {
    const sessions = makeSessionsRepository();
    const service = new LogoutService(sessions);

    await service.execute('player-1');

    expect(sessions.deleteByPlayerId).toHaveBeenCalledWith('player-1');
  });
});

describe('WsTokenService', () => {
  it('signs a short-lived ws-scoped token', () => {
    const sign = vi.fn().mockReturnValue('ws-token');
    const service = new WsTokenService({ sign });

    const token = service.execute('player-1');

    expect(sign).toHaveBeenCalledWith(
      { sub: 'player-1', scope: 'ws' },
      { expiresIn: '60s' },
    );
    expect(token).toBe('ws-token');
  });
});
