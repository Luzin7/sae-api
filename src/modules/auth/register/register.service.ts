import type { AuthResult, TokenPayload } from '../auth.entity.js';
import { UsernameTakenError } from '../auth.errors.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
} from '../auth.repository.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RegisterInput {
  name: string;
  password: string;
}

export class RegisterService {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly signing: {
      sign(
        payload: TokenPayload,
        options?: { expiresIn?: string | number },
      ): string;
    },
    private readonly passwords: {
      hash(plain: string): Promise<string>;
      verify(plain: string, hashed: string): Promise<boolean>;
    },
    private readonly refreshTokens: {
      generate(): string;
      hash(token: string): string;
    },
  ) {}

  async execute(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.credentials.findByUsername(input.name);
    if (existing) throw new UsernameTakenError();

    const passwordHash = await this.passwords.hash(input.password);
    const player = await this.credentials.create({
      name: input.name,
      passwordHash,
    });
    const refreshToken = await this.startSession(player.id);

    return {
      player,
      accessToken: this.signing.sign({ sub: player.id, name: player.name }),
      refreshToken,
    };
  }

  private async startSession(playerId: string): Promise<string> {
    const refreshToken = this.refreshTokens.generate();
    await this.sessions.create({
      playerId,
      tokenHash: this.refreshTokens.hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return refreshToken;
  }
}
