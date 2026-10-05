import type { Rng } from '@shared/dice/roll.js';
import { vi } from 'vitest';
import type { CharacterAccess } from './character-access.contract.js';
import type { ChatMessageRepository } from './chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from './player-directory.contract.js';

export function makeChatMessages(): ChatMessageRepository {
  return {
    findSession: vi.fn(),
    appendChat: vi.fn(),
    appendLog: vi.fn(),
    listRecentChat: vi.fn(),
  };
}

export function makeGameAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn() };
}

export function makeCharacterAccess(): CharacterAccess {
  return {
    findById: vi.fn(),
    findSkillById: vi.fn(),
    findSkillForCharacter: vi.fn(),
    updateHp: vi.fn(),
  };
}

export function makePlayerDirectory(
  names: Record<string, string> = {},
): PlayerDirectory {
  return {
    async findById(playerId: string) {
      const name = names[playerId];
      if (name === undefined) return null;

      return { id: playerId, name };
    },
  };
}

/** RNG that always rolls the same d20 face. */
export function fixedRng(value: number): Rng {
  return () => value;
}
