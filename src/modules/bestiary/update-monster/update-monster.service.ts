import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { Monster, UpdateMonsterInput } from '../bestiary.entity.js';
import {
  BestiaryForbiddenError,
  MonsterNotFoundError,
} from '../bestiary.errors.js';
import type { MonsterRepository } from '../bestiary.repository.js';

export class UpdateMonsterService {
  constructor(
    private readonly monsters: MonsterRepository,
    private readonly gameAccess: GameAccess,
  ) {}

  async execute(
    requesterId: string,
    id: string,
    input: UpdateMonsterInput,
  ): Promise<Monster> {
    const monster = await this.monsters.findById(id);
    if (!monster) throw new MonsterNotFoundError();

    const game = await this.gameAccess.findById(monster.gameId);
    if (!game || game.masterId !== requesterId) {
      throw new BestiaryForbiddenError();
    }

    const maxHp = input.maxHp ?? monster.maxHp;
    const maxEffort = input.maxEffort ?? monster.maxEffort;

    return this.monsters.save(id, {
      ...input,
      currentHp: Math.min(input.currentHp ?? monster.currentHp, maxHp),
      currentEffort: Math.min(
        input.currentEffort ?? monster.currentEffort,
        maxEffort,
      ),
    });
  }
}
