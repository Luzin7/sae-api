export interface ActiveSessionLookup {
  findActiveByGame(gameId: string): Promise<{ id: string } | null>;
}
