import type { DomainError } from '../errors/domain-error.js';
import { ForbiddenError } from '../errors/http-errors.js';
import type { GameRef } from './game-access.contract.js';

interface ParticipantAccess<G extends GameRef> {
  findById(gameId: string): Promise<G | null>;
  isMember(gameId: string, playerId: string): Promise<boolean>;
}

export interface RequireGameParticipantInput<G extends GameRef> {
  access: ParticipantAccess<G>;
  gameId: string;
  playerId: string;
  onMissing?: () => DomainError;
  onForbidden?: () => DomainError;
}

/**
 * The one place the "master OR member" rule lives. Slices pass their own error
 * vocabulary via onMissing/onForbidden; the branch never leaves this file.
 */
export async function requireGameParticipant<G extends GameRef>(
  input: RequireGameParticipantInput<G>,
): Promise<G> {
  const game = await input.access.findById(input.gameId);
  if (!game) throw input.onMissing?.() ?? new ForbiddenError();
  if (game.masterId === input.playerId) return game;

  const member = await input.access.isMember(input.gameId, input.playerId);
  if (!member) throw input.onForbidden?.() ?? new ForbiddenError();

  return game;
}