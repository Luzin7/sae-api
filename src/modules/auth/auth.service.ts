import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import type { LoginBody, RegisterBody } from './auth.schemas.js';

interface PlayerRepo {
  findByName(name: string): Promise<{ id: string; name: string; passwordHash?: string } | null>;
  create(data: { name: string; passwordHash: string }): Promise<{ id: string; name: string }>;
}

interface RefreshTokenRepo {
  create(data: {
    playerId: string;
    token: string;
    expiresAt: Date;
  }): Promise<{ token: string }>;
  findByToken(token: string): Promise<{
    token: string;
    expiresAt: Date;
    playerId: string;
    player?: { id: string; name: string };
  } | null>;
  deleteByToken(token: string): Promise<void>;
  deleteByPlayerId(playerId: string): Promise<void>;
}

interface HashService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
}

interface JwtService {
  sign(payload: { sub: string; name: string }): string;
}

interface AuthResult {
  player: { id: string; name: string };
  accessToken: string;
  refreshToken?: string;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly playerRepo: PlayerRepo,
    private readonly refreshTokenRepo: RefreshTokenRepo,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
  ) {}

  async register(body: RegisterBody): Promise<AuthResult> {
    const existing = await this.playerRepo.findByName(body.name);
    if (existing) throw new ConflictError('Player');

    const passwordHash = await this.hashService.hashPassword(body.password);
    const player = await this.playerRepo.create({ name: body.name, passwordHash });

    const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });
    const { token: refreshToken } = await this.createRefreshToken(player.id);

    return { player, accessToken, refreshToken };
  }

  async login(body: LoginBody): Promise<AuthResult> {
    const player = await this.playerRepo.findByName(body.name);
    if (!player) throw new NotFoundError('Player');

    const valid = await this.hashService.verifyPassword(body.password, player.passwordHash ?? '');
    if (!valid) throw new UnauthorizedError();

    const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });
    const { token: refreshToken } = await this.createRefreshToken(player.id);

    return { player: { id: player.id, name: player.name }, accessToken, refreshToken };
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    const stored = await this.refreshTokenRepo.findByToken(token);
    if (!stored) throw new UnauthorizedError();
    if (stored.expiresAt < new Date()) throw new UnauthorizedError();

    const player = stored.player ?? { id: stored.playerId, name: '' };
    const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });

    return { accessToken };
  }

  async logout(playerId: string): Promise<void> {
    await this.refreshTokenRepo.deleteByPlayerId(playerId);
  }

  private async createRefreshToken(playerId: string): Promise<{ token: string }> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    return this.refreshTokenRepo.create({ playerId, token, expiresAt });
  }
}
