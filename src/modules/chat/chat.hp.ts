import type { InMemoryMessageBus } from './chat.bus.js';
import type {
  CharacterAccess,
  CharacterSnapshot,
} from './character-access.contract.js';
import { chatRoom, type RealtimeEvent } from './chat.entity.js';
import { InvalidHpError } from './chat.errors.js';

/**
 * Persists an HP change (log and character row in one transaction) before
 * broadcasting, and returns the wire event. Shared by the self and
 * master-forced flows; authorization stays in the services.
 */
export async function applyHpChange(
  characters: CharacterAccess,
  bus: InMemoryMessageBus,
  input: {
    sessionId: string;
    playerId: string;
    character: CharacterSnapshot;
    newHp: number;
  },
): Promise<RealtimeEvent> {
  const { character, newHp } = input;
  if (newHp < 0 || newHp > character.maxHp) throw new InvalidHpError();

  const oldHp = character.currentHp;
  await characters.updateHpWithLog(character.id, newHp, {
    sessionId: input.sessionId,
    playerId: input.playerId,
    eventType: 'hp_change',
    payload: {
      characterId: character.id,
      delta: newHp - oldHp,
      currentHp: newHp,
      maxHp: character.maxHp,
    },
  });

  const event: RealtimeEvent = {
    type: 'character.hp-changed',
    characterId: character.id,
    oldHp,
    newHp,
  };
  bus.publish(chatRoom(input.sessionId), event);

  return event;
}
