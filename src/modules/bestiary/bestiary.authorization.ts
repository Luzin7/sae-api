import type {
  GameAccess,
  GameRef,
} from '@shared/game-access/game-access.contract.js';
import type { Monster } from './bestiary.entity.js';
import {
  BestiaryForbiddenError,
  MonsterNotFoundError,
} from './bestiary.errors.js';
import type { MonsterRepository } from './bestiary.repository.js';

export function canManageMonster(
  monster: Monster,
  game: GameRef | null,
  requesterId: string,
): boolean {
  if (monster.gameId === null) return monster.createdBy === requesterId;

  return game !== null && game.masterId === requesterId;
}

export async function requireManageableMonster(
  repository: MonsterRepository,
  access: GameAccess,
  id: string,
  requesterId: string,
): Promise<Monster> {
  const monster = await repository.findById(id);
  if (!monster) throw new MonsterNotFoundError();

  const game =
    monster.gameId === null ? null : await access.findById(monster.gameId);
  if (!canManageMonster(monster, game, requesterId)) {
    throw new BestiaryForbiddenError();
  }

  return monster;
}
