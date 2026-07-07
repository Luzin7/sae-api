import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerService } from './player.service.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';

const mockRepo = {
  findById: vi.fn(),
  findByName: vi.fn(),
  update: vi.fn(),
};

const mockHash = {
  hashPassword: vi.fn(),
};

const service = new PlayerService(mockRepo, mockHash);

beforeEach(() => vi.clearAllMocks());

describe('PlayerService.getById', () => {
  it('throws NotFoundError when player does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getById('unknown-id')).rejects.toThrow(NotFoundError);
  });

  it('returns player when found', async () => {
    const player = { id: 'p1', name: 'Alice', createdAt: new Date() };
    mockRepo.findById.mockResolvedValue(player);
    const result = await service.getById('p1');
    expect(result.name).toBe('Alice');
  });
});

describe('PlayerService.update', () => {
  it('throws NotFoundError when player does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update('unknown', { name: 'New' })).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when name is already taken', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'p1', name: 'Alice' });
    mockRepo.findByName.mockResolvedValue({ id: 'p2', name: 'Bob' });
    await expect(service.update('p1', { name: 'Bob' })).rejects.toThrow(ConflictError);
  });

  it('hashes new password when provided', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'p1', name: 'Alice' });
    mockRepo.findByName.mockResolvedValue(null);
    mockHash.hashPassword.mockResolvedValue('new-hash');
    mockRepo.update.mockResolvedValue({ id: 'p1', name: 'Alice' });

    await service.update('p1', { password: 'newSecret123' });

    expect(mockHash.hashPassword).toHaveBeenCalledWith('newSecret123');
  });

  it('updates player and returns result', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'p1', name: 'Alice' });
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue({ id: 'p1', name: 'NewName' });

    const result = await service.update('p1', { name: 'NewName' });

    expect(result.name).toBe('NewName');
  });
});
