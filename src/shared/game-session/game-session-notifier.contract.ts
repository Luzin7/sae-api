export interface HpChanged {
  characterId: string;
  oldHp: number;
  newHp: number;
}

export interface EffortChanged {
  characterId: string;
  oldPe: number;
  newPe: number;
}

/**
 * Cross-domain seam the character slice uses to refresh a live table. The
 * chat slice implements it; character never imports chat.
 */
export interface GameSessionNotifier {
  notifyRosterChanged(gameId: string): Promise<void>;
  notifyHpChanged(gameId: string, change: HpChanged): Promise<void>;
  notifyEffortChanged(gameId: string, change: EffortChanged): Promise<void>;
  notifyCombatChanged(gameId: string): Promise<void>;
}
