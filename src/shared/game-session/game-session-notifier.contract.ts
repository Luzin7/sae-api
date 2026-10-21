export interface HpChanged {
  characterId: string;
  oldHp: number;
  newHp: number;
}

/**
 * Cross-domain seam the character slice uses to refresh a live table. The
 * chat slice implements it; character never imports chat.
 */
export interface GameSessionNotifier {
  notifyRosterChanged(gameId: string): Promise<void>;
  notifyHpChanged(gameId: string, change: HpChanged): Promise<void>;
}
