import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateGameBody, UpdateGameBody } from './game.schemas.js';

interface PaginationOptions {
  limit: number;
  offset: number;
}

interface GameRepo {
  create(data: { masterId: string; name: string; description?: string; imageUrl?: string; inviteCode: string }): Promise<{ id: string; name: string; masterId: string; inviteCode: string }>;
  findById(id: string): Promise<{ id: string; name: string; masterId: string; inviteCode?: string } | null>;
  findByInviteCode(code: string): Promise<{ id: string; masterId: string } | null>;
  findByMasterId(masterId: string): Promise<{ id: string; name: string }[]>;
  findByPlayerId(playerId: string, pagination: PaginationOptions): Promise<{ id: string; name: string }[]>;
  update(id: string, data: Partial<{ name: string; description: string; imageUrl: string; isActive: boolean }>): Promise<{ id: string; name: string }>;
  delete(id: string): Promise<void>;
  addPlayer(gameId: string, playerId: string): Promise<void>;
  removePlayer(gameId: string, playerId: string): Promise<void>;
  getPlayers(gameId: string): Promise<{ id: string; name: string }[]>;
  isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}

interface InviteCodeService {
  generate(): string;
}

export class GameService {
  constructor(
    private readonly repo: GameRepo,
    private readonly inviteCodeService: InviteCodeService,
  ) {}

  async create(body: CreateGameBody, masterId: string) {
    const inviteCode = this.inviteCodeService.generate();
    const data: { masterId: string; name: string; inviteCode: string; description?: string; imageUrl?: string } = {
      masterId,
      inviteCode,
      name: body.name,
    };
    if (body.description) data.description = body.description;
    if (body.imageUrl) data.imageUrl = body.imageUrl;
    return this.repo.create(data);
  }

  async getById(id: string, requesterId: string) {
    const game = await this.repo.findById(id);
    if (!game) throw new NotFoundError('Game');

    const isMaster = game.masterId === requesterId;
    if (!isMaster) {
      const inGame = await this.repo.isPlayerInGame(id, requesterId);
      if (!inGame) throw new ForbiddenError();
    }

    return game;
  }

  async getMine(playerId: string, pagination: PaginationOptions = { limit: 20, offset: 0 }) {
    const [mastered, joined] = await Promise.all([
      this.repo.findByMasterId(playerId),
      this.repo.findByPlayerId(playerId, pagination),
    ]);
    const seen = new Set<string>();
    return [...mastered, ...joined].filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }

  async getMastered(masterId: string) {
    return this.repo.findByMasterId(masterId);
  }

  async join(inviteCode: string, playerId: string) {
    const game = await this.repo.findByInviteCode(inviteCode);
    if (!game) throw new NotFoundError('Invite code');

    const alreadyIn = await this.repo.isPlayerInGame(game.id, playerId);
    if (alreadyIn) throw new ConflictError('Player already in game');

    await this.repo.addPlayer(game.id, playerId);
    return game;
  }

  async update(id: string, body: UpdateGameBody, requesterId: string) {
    const game = await this.repo.findById(id);
    if (!game) throw new NotFoundError('Game');
    if (game.masterId !== requesterId) throw new ForbiddenError();

    const data: Partial<{ name: string; description: string; imageUrl: string; isActive: boolean }> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    return this.repo.update(id, data);
  }

  async delete(id: string, requesterId: string) {
    const game = await this.repo.findById(id);
    if (!game) throw new NotFoundError('Game');
    if (game.masterId !== requesterId) throw new ForbiddenError();

    await this.repo.delete(id);
  }

  async leave(gameId: string, playerId: string) {
    const game = await this.repo.findById(gameId);
    if (!game) throw new NotFoundError('Game');
    if (game.masterId === playerId) throw new ForbiddenError();

    await this.repo.removePlayer(gameId, playerId);
  }

  async getPlayers(gameId: string, requesterId: string) {
    const game = await this.repo.findById(gameId);
    if (!game) throw new NotFoundError('Game');

    const isMaster = game.masterId === requesterId;
    if (!isMaster) {
      const inGame = await this.repo.isPlayerInGame(gameId, requesterId);
      if (!inGame) throw new ForbiddenError();
    }

    return this.repo.getPlayers(gameId);
  }
}
