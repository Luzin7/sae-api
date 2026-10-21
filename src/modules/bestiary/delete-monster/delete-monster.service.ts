import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import {
  BestiaryForbiddenError,
  MonsterNotFoundError,
} from '../bestiary.errors.js';
import type { MonsterRepository } from '../bestiary.repository.js';

export class DeleteMonsterService {
  constructor(
    private readonly monsters: MonsterRepository,
    private readonly gameAccess: GameAccess,
  ) {}

  async execute(requesterId: string, id: string): Promise<void> {
    const monster = await this.monsters.findById(id);
    if (!monster) throw new MonsterNotFoundError();

    const game = await this.gameAccess.findById(monster.gameId);
    if (!game || game.masterId !== requesterId) {
      throw new BestiaryForbiddenError();
    }

    await this.monsters.delete(id);
  }
}
