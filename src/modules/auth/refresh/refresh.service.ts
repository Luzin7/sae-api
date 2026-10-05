import type { RefreshResult, TokenPayload } from '../auth.entity.js';
import { SessionExpiredError } from '../auth.errors.js';
import type { AuthSessionRepository } from '../auth.repository.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  ) {}

  // Rotation: the presented token is revoked and a fresh one issued on every
  // successful refresh, so a leaked token is single-use.
  async execute(presentedToken: string): Promise<RefreshResult> {
    const tokenHash = this.refreshTokens.hash(presentedToken);
    const session = await this.sessions.findByHash(tokenHash);
    if (!session) throw new SessionExpiredError();

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new SessionExpiredError();
    }

    await this.sessions.deleteByHash(tokenHash);
    const refreshToken = this.refreshTokens.generate();
    await this.sessions.create({
      playerId: session.playerId,
      tokenHash: this.refreshTokens.hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      accessToken: this.signing.sign({
        sub: session.playerId,
        name: session.name,
      }),
      refreshToken,
    };
  }
}
