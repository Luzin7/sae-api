import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireManageableMonster } from '../bestiary.authorization.js';
import type { MonsterRepository } from '../bestiary.repository.js';

export class DeleteMonsterService {
  constructor(
    private readonly monsters: MonsterRepository,
    private readonly gameAccess: GameAccess,
  ) {}

  async execute(requesterId: string, id: string): Promise<void> {
    await requireManageableMonster(
      this.monsters,
      this.gameAccess,
      id,
      requesterId,
    );

    await this.monsters.delete(id);
  }
}
