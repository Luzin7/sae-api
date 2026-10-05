import { requireMembership } from './game.authorization.js';
import {
  DEFAULT_GAME_PAGE,
  type Game,
  type GamePlayer,
  type GameSummary,
  type Page,
} from './game.entity.js';
import type { GameRepository } from './game.repository.js';

function mergeSummaries(
  mastered: GameSummary[],
  joined: GameSummary[],
): GameSummary[] {
  const seen = new Set<string>();
  return [...mastered, ...joined].filter((summary) => {
    if (seen.has(summary.id)) return false;
    seen.add(summary.id);
    return true;
  });
}

/**
 * Read-only operations. They carry no orchestration, so they live as methods
 * here instead of four empty classes.
 */
export class GameQueryService {
  constructor(private readonly games: GameRepository) {}

  async getGame(gameId: string, playerId: string): Promise<Game> {
    return requireMembership(this.games, gameId, playerId);
  }

  async getMine(
    playerId: string,
    page: Page = DEFAULT_GAME_PAGE,
  ): Promise<GameSummary[]> {
    const [mastered, joined] = await Promise.all([
      this.games.findMastered(playerId),
      this.games.findJoined(playerId, page),
    ]);

    return mergeSummaries(mastered, joined);
  }

  async getMastered(masterId: string): Promise<GameSummary[]> {
    return this.games.findMastered(masterId);
  }

  async getPlayers(gameId: string, playerId: string): Promise<GamePlayer[]> {
    await requireMembership(this.games, gameId, playerId);

    return this.games.findPlayers(gameId);
  }
}
