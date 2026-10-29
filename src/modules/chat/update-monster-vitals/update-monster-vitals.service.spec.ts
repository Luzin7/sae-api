import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { UpdateMonsterVitalsService } from './update-monster-vitals.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'monster',
      refId: 'monster-1',
      name: 'Goblin',
      initiativeValue: null,
      hasRolled: false,
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: [],
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
    },
  ],
};

const AFFLICTED_STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'monster',
      refId: 'monster-1',
      name: 'Goblin',
      initiativeValue: null,
      hasRolled: false,
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: ['ferido'],
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
    },
  ],
};

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combat = { ...makeCombat(), saveInstanceVitals: vi.fn() };
  const bus = new InMemoryMessageBus();
  const service = new UpdateMonsterVitalsService(messages, access, combat, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'p1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, access, combat, bus, service };
}

describe('UpdateMonsterVitalsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the combatant instance and persists before broadcasting', async () => {
    const { combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      currentHp: 99,
      currentEffort: -5,
    });

    expect(combat.saveInstanceVitals).toHaveBeenCalledTimes(1);
    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      'session-1',
      'monster-1',
      { currentHp: 20, currentEffort: 0 },
      'p1',
    );
    expect(event).toEqual({
      type: 'session.monster-vitals',
      monsterId: 'monster-1',
      currentHp: 20,
      maxHp: 20,
      currentEffort: 0,
      maxEffort: 10,
      afflictions: [],
    });
    expect(publish).toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.monster-vitals' }),
    );
  });

  it('sends both vitals in the patch when the edit changes nothing', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      currentHp: 20,
      currentEffort: 10,
    });

    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      'session-1',
      'monster-1',
      { currentHp: 20, currentEffort: 10 },
      'p1',
    );
    expect(event).toEqual({
      type: 'session.monster-vitals',
      monsterId: 'monster-1',
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: [],
    });
  });

  it('applies the afflictions from the frame and reports the resulting list', async () => {
    const { combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      currentHp: 15,
      currentEffort: 8,
      afflictions: ['ferido', 'atordoado'],
    });

    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      'session-1',
      'monster-1',
      {
        currentHp: 15,
        currentEffort: 8,
        afflictions: ['ferido', 'atordoado'],
      },
      'p1',
    );
    expect(event).toMatchObject({ afflictions: ['ferido', 'atordoado'] });
    expect(publish).toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ afflictions: ['ferido', 'atordoado'] }),
    );
  });

  it('keeps the instance afflictions when the frame omits them', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(AFFLICTED_STATE);

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      currentHp: 12,
      currentEffort: 5,
    });

    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      'session-1',
      'monster-1',
      { currentHp: 12, currentEffort: 5 },
      'p1',
    );
    expect(event).toMatchObject({ afflictions: ['ferido'] });
  });

  it('forbids a non-master before touching the monster', async () => {
    const { access, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.findState).not.toHaveBeenCalled();
    expect(combat.saveInstanceVitals).not.toHaveBeenCalled();
  });

  it('rejects when there is no active combat', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
    expect(combat.saveInstanceVitals).not.toHaveBeenCalled();
  });

  it('rejects a monster from another game', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'foreign-monster',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
    expect(combat.saveInstanceVitals).not.toHaveBeenCalled();
  });
});
