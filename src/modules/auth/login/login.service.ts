import type { AuthResult, TokenPayload } from '../auth.entity.js';
import { InvalidCredentialsError } from '../auth.errors.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
} from '../auth.repository.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginInput {
  name: string;
  password: string;
}

export class LoginService {
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

  async execute(input: LoginInput): Promise<AuthResult> {
    const account = await this.credentials.findByUsername(input.name);
    if (!account) throw new InvalidCredentialsError();

    const valid = await this.passwords.verify(
      input.password,
      account.passwordHash,
    );
    if (!valid) throw new InvalidCredentialsError();

    const refreshToken = this.refreshTokens.generate();
    await this.sessions.create({
      playerId: account.id,
      tokenHash: this.refreshTokens.hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      player: { id: account.id, name: account.name },
      accessToken: this.signing.sign({
        sub: account.id,
        name: account.name,
      }),
      refreshToken,
    };
  }
}
