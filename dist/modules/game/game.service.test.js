import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameService } from './game.service.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors.js';
const mockRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findByInviteCode: vi.fn(),
    findByMasterId: vi.fn(),
    findByPlayerId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    getPlayers: vi.fn(),
    isPlayerInGame: vi.fn(),
};
const mockInviteCode = { generate: vi.fn() };
const service = new GameService(mockRepo, mockInviteCode);
beforeEach(() => vi.clearAllMocks());
describe('GameService.create', () => {
    it('creates game with generated invite code', async () => {
        mockInviteCode.generate.mockReturnValue('CODE123');
        mockRepo.create.mockResolvedValue({ id: 'g1', name: 'My Game', inviteCode: 'CODE123', masterId: 'p1' });
        const result = await service.create({ name: 'My Game' }, 'p1');
        expect(mockInviteCode.generate).toHaveBeenCalled();
        expect(result.inviteCode).toBe('CODE123');
    });
});
describe('GameService.getById', () => {
    it('throws NotFoundError when game not found', async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(service.getById('nonexistent', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ForbiddenError when player is not in the game', async () => {
        mockRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master' });
        mockRepo.isPlayerInGame.mockResolvedValue(false);
        await expect(service.getById('g1', 'outsider')).rejects.toThrow(ForbiddenError);
    });
    it('returns game when player is master', async () => {
        const game = { id: 'g1', masterId: 'p1', name: 'Test' };
        mockRepo.findById.mockResolvedValue(game);
        mockRepo.isPlayerInGame.mockResolvedValue(false);
        const result = await service.getById('g1', 'p1');
        expect(result.id).toBe('g1');
    });
});
describe('GameService.join', () => {
    it('throws NotFoundError when invite code is invalid', async () => {
        mockRepo.findByInviteCode.mockResolvedValue(null);
        await expect(service.join('INVALID', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ConflictError when player is already in game', async () => {
        mockRepo.findByInviteCode.mockResolvedValue({ id: 'g1', masterId: 'master' });
        mockRepo.isPlayerInGame.mockResolvedValue(true);
        await expect(service.join('CODE', 'p1')).rejects.toThrow(ConflictError);
    });
    it('adds player to game successfully', async () => {
        mockRepo.findByInviteCode.mockResolvedValue({ id: 'g1', masterId: 'master' });
        mockRepo.isPlayerInGame.mockResolvedValue(false);
        mockRepo.addPlayer.mockResolvedValue(undefined);
        await service.join('CODE', 'p1');
        expect(mockRepo.addPlayer).toHaveBeenCalledWith('g1', 'p1');
    });
});
describe('GameService.delete', () => {
    it('throws ForbiddenError when player is not the master', async () => {
        mockRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master' });
        await expect(service.delete('g1', 'other-player')).rejects.toThrow(ForbiddenError);
    });
    it('deletes game when player is master', async () => {
        mockRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockRepo.delete.mockResolvedValue(undefined);
        await service.delete('g1', 'p1');
        expect(mockRepo.delete).toHaveBeenCalledWith('g1');
    });
});
describe('GameService.getMine', () => {
    it('passes limit and offset to repo', async () => {
        mockRepo.findByPlayerId.mockResolvedValue([]);
        await service.getMine('p1', { limit: 10, offset: 5 });
        expect(mockRepo.findByPlayerId).toHaveBeenCalledWith('p1', { limit: 10, offset: 5 });
    });
    it('uses defaults when pagination not provided', async () => {
        mockRepo.findByPlayerId.mockResolvedValue([]);
        await service.getMine('p1');
        expect(mockRepo.findByPlayerId).toHaveBeenCalledWith('p1', { limit: 20, offset: 0 });
    });
});
//# sourceMappingURL=game.service.test.js.map