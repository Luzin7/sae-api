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

export interface NpChanged {
  characterId: string;
  oldNp: number;
  newNp: number;
}

export interface CharacterAdvanced {
  characterId: string;
}

/**
 * Cross-domain seam the character slice uses to refresh a live table. The
 * chat slice implements it; character never imports chat.
 */
export interface GameSessionNotifier {
  notifyRosterChanged(gameId: string): Promise<void>;
  notifyHpChanged(gameId: string, change: HpChanged): Promise<void>;
  notifyEffortChanged(gameId: string, change: EffortChanged): Promise<void>;
  notifyNpChanged(gameId: string, change: NpChanged): Promise<void>;
  notifyCharacterAdvanced(
    gameId: string,
    change: CharacterAdvanced,
  ): Promise<void>;
  notifyCombatChanged(gameId: string): Promise<void>;
}
