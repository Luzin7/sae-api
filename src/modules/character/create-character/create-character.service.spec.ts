import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Rng } from '../character.derivation.js';
import {
  AttributeBudgetExceededError,
  InvalidArchetypeError,
  InvalidAttributeError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
} from '../character.testkit.js';
import { CreateCharacterService } from './create-character.service.js';
import type { CreateCharacterCommand } from './create-character.service.js';

function fixedRng(value: number): Rng {
  return () => value;
}

function baseCommand(
  overrides: Partial<CreateCharacterCommand> = {},
): CreateCharacterCommand {
  return {
    gameId: 'game-1',
    nickname: 'Hero',
    np: 1,
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    personality: 'Erudito',
    posture: 'Abrutalhado',
    socialClass: 'plebeu',
    ...overrides,
  };
}

describe('CreateCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids creating a character when the player is not a game member', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(false);

    await expect(
      new CreateCharacterService(characters, membership, fixedRng(1)).execute(
        'player-1',
        baseCommand(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('allows the game master who is not a member to create a character', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    vi.mocked(membership.isMember).mockResolvedValue(false);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalled();
  });

  it('rejects an attribute spread above the np budget', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(characters, membership, fixedRng(1)).execute(
        'player-1',
        baseCommand({ cognition: 5, psyche: 5, instinct: 5, motricity: 5 }),
      ),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects -1/0 as attribute values', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(characters, membership, fixedRng(1)).execute(
        'player-1',
        baseCommand({ cognition: 0 }),
      ),
    ).rejects.toBeInstanceOf(InvalidAttributeError);
  });

  it('rejects an unknown personality/posture pair', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(characters, membership, fixedRng(1)).execute(
        'player-1',
        baseCommand({ posture: 'Inexistente' }),
      ),
    ).rejects.toBeInstanceOf(InvalidArchetypeError);
  });

  it('derives proficiency levels from personality + posture', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitionProficiency: 'especialista',
        psycheProficiency: 'imperito',
        instinctProficiency: 'imperito',
        constitutionProficiency: 'especialista',
        motricityProficiency: 'imperito',
        perceptionProficiency: 'imperito',
      }),
    );
  });

  it('persists maxHp, maxEffort, bExp and a zeroed current effort', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
    ).execute('player-1', baseCommand({ np: 5, constitution: 2 }));

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-1',
        maxHp: 20 + 5 * 10,
        currentHp: 20 + 5 * 10,
        maxEffort: 20,
        currentEffort: 0,
        bExp: 2,
      }),
    );
  });

  it('derives size and vaalaques from the sheet', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
    ).execute('player-1', baseCommand({ heightCm: 160, weightKg: 60 }));

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ size: 'pequeno', vaalaques: 2 * 40 }),
    );
  });
});
