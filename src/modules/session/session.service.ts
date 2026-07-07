import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';

interface SessionData {
  id: string;
  gameId: string;
  isActive: boolean;
  startedAt: Date;
  endedAt: Date | null;
}

interface GameData {
  id: string;
  masterId: string;
}

interface SessionLogData {
  id: string;
  sessionId: string;
  playerId: string | null;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

interface SessionRepo {
  create(gameId: string): Promise<SessionData>;
  findActiveByGameId(gameId: string): Promise<SessionData | null>;
  endSession(sessionId: string): Promise<SessionData>;
  findLogsBySessionId(sessionId: string): Promise<SessionLogData[]>;
}

interface GameRepo {
  findById(id: string): Promise<GameData | null>;
  isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}

export class SessionService {
  constructor(
    private readonly repo: SessionRepo,
    private readonly gameRepo: GameRepo,
  ) {}

  async start(gameId: string, requesterId: string): Promise<SessionData> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundError('Game');
    if (game.masterId !== requesterId) throw new ForbiddenError();

    const existing = await this.repo.findActiveByGameId(gameId);
    if (existing) throw new ConflictError('Session');

    return this.repo.create(gameId);
  }

  async end(gameId: string, requesterId: string): Promise<SessionData> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundError('Game');
    if (game.masterId !== requesterId) throw new ForbiddenError();

    const active = await this.repo.findActiveByGameId(gameId);
    if (!active) throw new NotFoundError('Session');

    return this.repo.endSession(active.id);
  }

  async getActive(gameId: string, requesterId: string): Promise<SessionData | null> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundError('Game');

    const isMaster = game.masterId === requesterId;
    if (!isMaster) {
      const inGame = await this.gameRepo.isPlayerInGame(gameId, requesterId);
      if (!inGame) throw new ForbiddenError();
    }

    return this.repo.findActiveByGameId(gameId);
  }

  async getLogs(gameId: string, sessionId: string, requesterId: string): Promise<SessionLogData[]> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundError('Game');

    const isMaster = game.masterId === requesterId;
    if (!isMaster) {
      const inGame = await this.gameRepo.isPlayerInGame(gameId, requesterId);
      if (!inGame) throw new ForbiddenError();
    }

    return this.repo.findLogsBySessionId(sessionId);
  }
}
