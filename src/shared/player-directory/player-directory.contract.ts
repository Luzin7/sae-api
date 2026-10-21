export interface PlayerRef {
  id: string;
  name: string;
}

/**
 * Cross-domain seam for player display names and game character links.
 * Realtime frames and game rosters carry both, so consumers resolve them here
 * instead of importing the `player` or `character` slice. The infra adapter
 * reads those tables directly.
 */
export interface PlayerDirectory {
  findById(playerId: string): Promise<PlayerRef | null>;
  findCharactersByGame(gameId: string): Promise<Map<string, string[]>>;
}
