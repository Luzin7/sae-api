import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CreateMonsterInput, Monster } from '../bestiary.entity.js';
import { BestiaryForbiddenError } from '../bestiary.errors.js';
import type { MonsterRepository } from '../bestiary.repository.js';

const DEFAULT_ATTRIBUTE = -5;

export class CreateMonsterService {
  constructor(
    private readonly monsters: MonsterRepository,
    private readonly gameAccess: GameAccess,
  ) {}

  async execute(
    requesterId: string,
    input: Omit<CreateMonsterInput, 'createdBy'>,
  ): Promise<Monster> {
    await this.requireCanCreate(requesterId, input.gameId);

    return this.monsters.create({
      ...input,
      gameId: input.gameId ?? null,
      createdBy: requesterId,
      currentHp: input.currentHp ?? input.maxHp,
      currentEffort: input.currentEffort ?? input.maxEffort,
      cognition: input.cognition ?? DEFAULT_ATTRIBUTE,
      psyche: input.psyche ?? DEFAULT_ATTRIBUTE,
      instinct: input.instinct ?? DEFAULT_ATTRIBUTE,
      constitution: input.constitution ?? DEFAULT_ATTRIBUTE,
      motricity: input.motricity ?? DEFAULT_ATTRIBUTE,
      perception: input.perception ?? DEFAULT_ATTRIBUTE,
    });
  }

  private async requireCanCreate(
    requesterId: string,
    gameId: string | null | undefined,
  ): Promise<void> {
    if (!gameId) {
      if (await this.gameAccess.mastersAnyGame(requesterId)) return;

      throw new BestiaryForbiddenError();
    }

    const game = await this.gameAccess.findById(gameId);
    if (!game || game.masterId !== requesterId) {
      throw new BestiaryForbiddenError();
    }
  }
}
