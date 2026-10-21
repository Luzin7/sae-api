import { ChatForbiddenError } from './chat.errors.js';
import type {
  PlayerPresence,
  PlayerSummary,
  PresenceSnapshot,
} from './chat.entity.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';

/** Resolves one player's display name or fails the frame (no anonymous room). */
export async function resolvePlayerSummary(
  directory: PlayerDirectory,
  playerId: string,
): Promise<PlayerSummary> {
  const player = await directory.findById(playerId);
  if (!player) throw new ChatForbiddenError();

  return { playerId, name: player.name };
}

function toPresence(
  playerId: string,
  name: string,
  characters: Map<string, string[]>,
): PlayerPresence {
  return {
    playerId,
    name,
    characterIds: characters.get(playerId) ?? [],
  };
}

/**
 * Resolves a room's connected ids into the presence snapshot. Unknown ids are
 * dropped; presence is best-effort and must never throw. The master is moved
 * out of `players` so the roster never renders them as a character owner.
 */
export async function resolvePresence(
  directory: PlayerDirectory,
  gameId: string,
  playerIds: string[],
  masterId: string,
): Promise<PresenceSnapshot> {
  const [characters, refs] = await Promise.all([
    directory.findCharactersByGame(gameId),
    Promise.all(playerIds.map((playerId) => directory.findById(playerId))),
  ]);

  const connected = refs.flatMap((ref) => (ref ? [ref] : []));
  const master = connected.find((ref) => ref.id === masterId) ?? null;

  return {
    master: master ? { playerId: master.id, name: master.name } : null,
    players: connected
      .filter((ref) => ref.id !== masterId)
      .map((ref) => toPresence(ref.id, ref.name, characters)),
  };
}

/** One connected player, resolved through the same batch character lookup. */
export async function resolvePlayerPresence(
  directory: PlayerDirectory,
  gameId: string,
  playerId: string,
): Promise<PlayerPresence | null> {
  const [player, characters] = await Promise.all([
    directory.findById(playerId),
    directory.findCharactersByGame(gameId),
  ]);
  if (!player) return null;

  return toPresence(player.id, player.name, characters);
}
