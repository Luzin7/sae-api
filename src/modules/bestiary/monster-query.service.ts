import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireManageableMonster } from './bestiary.authorization.js';
import type { Monster } from './bestiary.entity.js';
import { BestiaryForbiddenError } from './bestiary.errors.js';
import type { MonsterRepository } from './bestiary.repository.js';

export class MonsterQueryService {
  constructor(
    private readonly monsters: MonsterRepository,
    private readonly gameAccess: GameAccess,
  ) {}

  async listByGame(requesterId: string, gameId: string): Promise<Monster[]> {
    const game = await this.gameAccess.findById(gameId);
    if (!game || game.masterId !== requesterId) {
      throw new BestiaryForbiddenError();
    }

    const table = await this.monsters.findByGame(gameId);
    const reusable = await this.monsters.findReusableByOwner(game.masterId);

    return [...table, ...reusable];
  }

  async listReusable(requesterId: string): Promise<Monster[]> {
    return this.monsters.findReusableByOwner(requesterId);
  }

  async getById(requesterId: string, id: string): Promise<Monster> {
    return requireManageableMonster(
      this.monsters,
      this.gameAccess,
      id,
      requesterId,
    );
  }
}
