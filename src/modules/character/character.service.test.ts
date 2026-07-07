import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterService } from './character.service.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

const mockRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByPlayerId: vi.fn(),
  findByGameId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  findItems: vi.fn(),
  findSkills: vi.fn(),
  upsertSkill: vi.fn(),
};

const mockGameRepo = {
  isPlayerInGame: vi.fn(),
};

const service = new CharacterService(mockRepo, mockGameRepo);

beforeEach(() => vi.clearAllMocks());

describe('CharacterService.create', () => {
  it('calculates maxHp, maxEffort and bExp on creation', async () => {
    mockGameRepo.isPlayerInGame.mockResolvedValue(true);
    mockRepo.create.mockImplementation(async (data: Record<string, unknown>) =>
      ({ id: 'c1', ...data }),
    );

    const result = await service.create(
      { gameId: 'g1', nickname: 'Hero', level: 5, constitution: 2, profConstitution: 0, profCognition: 0, profPsyche: 0, profInstinct: 0, profMotricity: 0, profPerception: 0, cognition: 0, psyche: 0, instinct: 0, motricity: 0, perception: 0 },
      'p1',
    );

    expect(result.maxHp).toBe(20 + 5 * 10 + 0);
    expect(result.bExp).toBe(2);
  });

  it('throws ForbiddenError when player is not in the game', async () => {
    mockGameRepo.isPlayerInGame.mockResolvedValue(false);
    await expect(
      service.create({ gameId: 'g1', nickname: 'Hero', level: 1, constitution: 0, profConstitution: 0, profCognition: 0, profPsyche: 0, profInstinct: 0, profMotricity: 0, profPerception: 0, cognition: 0, psyche: 0, instinct: 0, motricity: 0, perception: 0 }, 'p1'),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('CharacterService.getById', () => {
  it('throws NotFoundError when character does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getById('unknown', 'p1')).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when player does not own the character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'owner' });
    await expect(service.getById('c1', 'other-player')).rejects.toThrow(ForbiddenError);
  });

  it('returns character when owner requests', async () => {
    const char = { id: 'c1', playerId: 'p1', nickname: 'Hero' };
    mockRepo.findById.mockResolvedValue(char);
    const result = await service.getById('c1', 'p1');
    expect(result.nickname).toBe('Hero');
  });
});

describe('CharacterService.delete', () => {
  it('throws ForbiddenError when player does not own the character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'owner' });
    await expect(service.delete('c1', 'intruder')).rejects.toThrow(ForbiddenError);
  });

  it('deletes character when owner requests', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'p1' });
    mockRepo.delete.mockResolvedValue(undefined);

    await service.delete('c1', 'p1');

    expect(mockRepo.delete).toHaveBeenCalledWith('c1');
  });
});

describe('CharacterService.getSkills', () => {
  it('throws NotFoundError when character does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getSkills('unknown', 'p1')).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when player does not own the character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'owner' });
    await expect(service.getSkills('c1', 'other-player')).rejects.toThrow(ForbiddenError);
  });

  it('returns skills list when owner requests', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'p1' });
    mockRepo.findSkills.mockResolvedValue([{ id: 'sk1', skill: 'knowledge', points: 3 }]);

    const result = await service.getSkills('c1', 'p1');

    expect(mockRepo.findSkills).toHaveBeenCalledWith('c1');
    expect(result).toHaveLength(1);
    expect(result[0]?.skill).toBe('knowledge');
  });
});

describe('CharacterService.upsertSkill', () => {
  it('throws NotFoundError when character does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.upsertSkill('unknown', 'p1', 'knowledge', 3)).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when player does not own the character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'owner' });
    await expect(service.upsertSkill('c1', 'other-player', 'knowledge', 3)).rejects.toThrow(ForbiddenError);
  });

  it('calls upsertSkill on repo and returns result', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'p1' });
    mockRepo.upsertSkill.mockResolvedValue({ id: 'sk1', characterId: 'c1', skill: 'knowledge', points: 3 });

    const result = await service.upsertSkill('c1', 'p1', 'knowledge', 3);

    expect(mockRepo.upsertSkill).toHaveBeenCalledWith('c1', 'knowledge', 3);
    expect(result.points).toBe(3);
  });
});

describe('CharacterService.getItems', () => {
  it('returns items for owned character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'p1' });
    mockRepo.findItems.mockResolvedValue([{ id: 'i1', name: 'Knife', type: 'weapon' }]);

    const result = await service.getItems('c1', 'p1');

    expect(mockRepo.findItems).toHaveBeenCalledWith('c1');
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundError when character does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getItems('unknown', 'p1')).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when player does not own the character', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', playerId: 'owner' });
    await expect(service.getItems('c1', 'other')).rejects.toThrow(ForbiddenError);
  });
});
