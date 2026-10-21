import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { StartCombatService } from './start-combat.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'character',
      refId: 'char-1',
      name: 'Ana',
      initiativeValue: null,
      hasRolled: false,
    },
  ],
};

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new StartCombatService(
    messages,
    access,
    combatants,
    combat,
    bus,
  );

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'p1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, access, combatants, combat, bus, service };
}

describe('StartCombatService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds the roster from the game and persists before broadcasting', async () => {
    const { messages, combatants, combat, bus, service } = build();
    vi.mocked(combatants.listByGame).mockResolvedValue([
      { kind: 'character', refId: 'char-1', name: 'Ana', ownerPlayerId: 'p1' },
    ]);
    vi.mocked(combat.start).mockResolvedValue(STATE);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({ playerId: 'p1', sessionId: 'session-1' });

    expect(combat.start).toHaveBeenCalledWith('session-1', [
      { kind: 'character', refId: 'char-1', name: 'Ana' },
    ]);
    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'combat_state',
      payload: STATE,
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('forbids a non-master', async () => {
    const { access, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({ playerId: 'p1', sessionId: 'session-1' }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.start).not.toHaveBeenCalled();
  });
});
