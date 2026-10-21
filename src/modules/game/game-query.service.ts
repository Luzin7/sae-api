import { requireMembership } from './game.authorization.js';
import {
  DEFAULT_GAME_PAGE,
  type Game,
  type GamePlayerPresence,
  type GameRoster,
  type Page,
} from './game.entity.js';
import type { GameRepository } from './game.repository.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';

function mergeById(mastered: Game[], joined: Game[]): Game[] {
  const seen = new Set<string>();
  return [...mastered, ...joined].filter((game) => {
    if (seen.has(game.id)) return false;
    seen.add(game.id);
    return true;
  });
}

/**
 * Read-only operations. They carry no orchestration, so they live as methods
 * here instead of four empty classes.
 */
export class GameQueryService {
  constructor(
    private readonly games: GameRepository,
    private readonly players: PlayerDirectory,
  ) {}

  async getGame(gameId: string, playerId: string): Promise<Game> {
    return requireMembership(this.games, gameId, playerId);
  }

  async getMine(
    playerId: string,
    page: Page = DEFAULT_GAME_PAGE,
  ): Promise<Game[]> {
    const [mastered, joined] = await Promise.all([
      this.games.findMastered(playerId),
      this.games.findJoined(playerId, page),
    ]);

    return mergeById(mastered, joined);
  }

  async getMastered(masterId: string): Promise<Game[]> {
    return this.games.findMastered(masterId);
  }

  async getPlayers(gameId: string, playerId: string): Promise<GameRoster> {
    const game = await requireMembership(this.games, gameId, playerId);
    const [members, characters, master] = await Promise.all([
      this.games.findPlayers(gameId),
      this.players.findCharactersByGame(gameId),
      this.players.findById(game.masterId),
    ]);

    return {
      master: master ? { id: master.id, name: master.name } : null,
      players: members
        .filter((member) => member.id !== game.masterId)
        .map((member): GamePlayerPresence => ({
          id: member.id,
          name: member.name,
          characterIds: characters.get(member.id) ?? [],
        })),
    };
  }
}
