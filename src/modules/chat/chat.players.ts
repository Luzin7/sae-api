import { ChatForbiddenError } from './chat.errors.js';
import type { PlayerSummary } from './chat.entity.js';
import type { PlayerDirectory } from './player-directory.contract.js';

/** Resolves one player's display name or fails the frame (no anonymous room). */
export async function resolvePlayerSummary(
  directory: PlayerDirectory,
  playerId: string,
): Promise<PlayerSummary> {
  const player = await directory.findById(playerId);
  if (!player) throw new ChatForbiddenError();

  return { playerId, name: player.name };
}

/**
 * Resolves a room's presence (player ids from the bus) into wire summaries.
 * Unknown ids are dropped; presence is best-effort and must never throw.
 */
export async function resolvePlayers(
  directory: PlayerDirectory,
  playerIds: string[],
): Promise<PlayerSummary[]> {
  const players = await Promise.all(
    playerIds.map((playerId) => directory.findById(playerId)),
  );

  return players.flatMap((player) =>
    player ? [{ playerId: player.id, name: player.name }] : [],
  );
}
