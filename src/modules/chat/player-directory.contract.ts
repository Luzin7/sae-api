export interface PlayerRef {
  id: string;
  name: string;
}

/**
 * Consumer-owned cross-domain contract for player display names. Realtime
 * frames carry `name`, so the slice resolves it through this seam instead of
 * importing the `player` slice. The infra adapter reads `player` directly.
 */
export interface PlayerDirectory {
  findById(playerId: string): Promise<PlayerRef | null>;
}
