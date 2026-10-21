import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { Monster } from './bestiary.entity.js';
import {
  BestiaryForbiddenError,
  MonsterNotFoundError,
} from './bestiary.errors.js';
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

    return this.monsters.findByGame(gameId);
  }

  async getById(requesterId: string, id: string): Promise<Monster> {
    const monster = await this.monsters.findById(id);
    if (!monster) throw new MonsterNotFoundError();

    const game = await this.gameAccess.findById(monster.gameId);
    if (!game || game.masterId !== requesterId) {
      throw new BestiaryForbiddenError();
    }

    return monster;
  }
}
