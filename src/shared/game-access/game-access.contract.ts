export interface GameRef {
  id: string;
  masterId: string;
}

/**
 * Single cross-domain seam over `game` + `player_game`. Every slice that needs
 * to know who may act on a game consumes this, so the participation rule can
 * never drift between slices.
 */
export interface GameAccess {
  findById(gameId: string): Promise<GameRef | null>;
  isMember(gameId: string, playerId: string): Promise<boolean>;
}