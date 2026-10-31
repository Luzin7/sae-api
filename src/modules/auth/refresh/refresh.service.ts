import type { RefreshResult, TokenPayload } from '../auth.entity.js';
import {
  RefreshTokenReusedError,
  SessionExpiredError,
  SessionRevokedError,
} from '../auth.errors.js';
import type { AuthSessionRepository } from '../auth.repository.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_GRACE_WINDOW_MS = 30_000;

export interface RefreshLogger {
  warn(details: object, message: string): void;
}

export class RefreshService {
  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly signing: {
      sign(
        payload: TokenPayload,
        options?: { expiresIn?: string | number },
      ): string;
    },
    private readonly refreshTokens: {
      generate(): string;
      hash(token: string): string;
    },
    private readonly logger: RefreshLogger,
  ) {}

  async execute(presentedToken: string): Promise<RefreshResult> {
    if (!presentedToken) throw new SessionExpiredError();

    const refreshToken = this.refreshTokens.generate();
    const now = new Date();
    const outcome = await this.sessions.rotate({
      presentedHash: this.refreshTokens.hash(presentedToken),
      successorHash: this.refreshTokens.hash(refreshToken),
      successorExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      now,
      graceWindowMs: REFRESH_GRACE_WINDOW_MS,
    });
    if (outcome.status === 'reused') {
      this.logger.warn(
        { playerId: outcome.playerId, familyId: outcome.familyId },
        'refresh token reuse detected',
      );
      throw new RefreshTokenReusedError();
    }
    if (outcome.status === 'revoked') {
      this.logger.warn(
        { playerId: outcome.playerId, familyId: outcome.familyId },
        'refresh token presented after revocation',
      );
      throw new SessionRevokedError();
    }
    if (outcome.status !== 'issued') throw new SessionExpiredError();

    return {
      accessToken: this.signing.sign({
        sub: outcome.playerId,
        name: outcome.name,
      }),
      refreshToken,
    };
  }
}
