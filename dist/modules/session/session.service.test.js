import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from './session.service.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors.js';
const mockSessionRepo = {
    create: vi.fn(),
    findActiveByGameId: vi.fn(),
    endSession: vi.fn(),
    findLogsBySessionId: vi.fn(),
};
const mockGameRepo = {
    findById: vi.fn(),
    isPlayerInGame: vi.fn(),
};
const service = new SessionService(mockSessionRepo, mockGameRepo);
beforeEach(() => vi.clearAllMocks());
describe('SessionService.start', () => {
    it('throws NotFoundError when game does not exist', async () => {
        mockGameRepo.findById.mockResolvedValue(null);
        await expect(service.start('g1', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ForbiddenError when requester is not the master', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
        await expect(service.start('g1', 'other-player')).rejects.toThrow(ForbiddenError);
    });
    it('throws ConflictError when there is already an active session', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue({ id: 's1', isActive: true });
        await expect(service.start('g1', 'p1')).rejects.toThrow(ConflictError);
    });
    it('creates and returns a new session when master requests', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue(null);
        mockSessionRepo.create.mockResolvedValue({ id: 's1', gameId: 'g1', isActive: true, startedAt: new Date(), endedAt: null });
        const result = await service.start('g1', 'p1');
        expect(mockSessionRepo.create).toHaveBeenCalledWith('g1');
        expect(result.isActive).toBe(true);
    });
});
describe('SessionService.end', () => {
    it('throws NotFoundError when game does not exist', async () => {
        mockGameRepo.findById.mockResolvedValue(null);
        await expect(service.end('g1', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ForbiddenError when requester is not the master', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
        await expect(service.end('g1', 'not-master')).rejects.toThrow(ForbiddenError);
    });
    it('throws NotFoundError when no active session exists', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue(null);
        await expect(service.end('g1', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('ends the active session when master requests', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue({ id: 's1', isActive: true });
        mockSessionRepo.endSession.mockResolvedValue({ id: 's1', isActive: false, endedAt: new Date() });
        const result = await service.end('g1', 'p1');
        expect(mockSessionRepo.endSession).toHaveBeenCalledWith('s1');
        expect(result.isActive).toBe(false);
    });
});
describe('SessionService.getActive', () => {
    it('throws NotFoundError when game does not exist', async () => {
        mockGameRepo.findById.mockResolvedValue(null);
        await expect(service.getActive('g1', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ForbiddenError when player is not in the game', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
        mockGameRepo.isPlayerInGame.mockResolvedValue(false);
        await expect(service.getActive('g1', 'p1')).rejects.toThrow(ForbiddenError);
    });
    it('returns active session for the game master', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue({ id: 's1', gameId: 'g1', isActive: true, startedAt: new Date(), endedAt: null });
        const result = await service.getActive('g1', 'p1');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('s1');
    });
    it('returns null when no active session exists', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findActiveByGameId.mockResolvedValue(null);
        const result = await service.getActive('g1', 'p1');
        expect(result).toBeNull();
    });
});
describe('SessionService.getLogs', () => {
    it('throws NotFoundError when game does not exist', async () => {
        mockGameRepo.findById.mockResolvedValue(null);
        await expect(service.getLogs('g1', 's1', 'p1')).rejects.toThrow(NotFoundError);
    });
    it('throws ForbiddenError when player is not in game', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
        mockGameRepo.isPlayerInGame.mockResolvedValue(false);
        await expect(service.getLogs('g1', 's1', 'p1')).rejects.toThrow(ForbiddenError);
    });
    it('returns logs for master without game membership check', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'p1' });
        mockSessionRepo.findLogsBySessionId.mockResolvedValue([
            { id: 'l1', sessionId: 's1', eventType: 'dice_roll', payload: {}, createdAt: new Date() },
        ]);
        const result = await service.getLogs('g1', 's1', 'p1');
        expect(mockSessionRepo.findLogsBySessionId).toHaveBeenCalledWith('s1');
        expect(result).toHaveLength(1);
    });
    it('returns logs for a player in the game', async () => {
        mockGameRepo.findById.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
        mockGameRepo.isPlayerInGame.mockResolvedValue(true);
        mockSessionRepo.findLogsBySessionId.mockResolvedValue([]);
        const result = await service.getLogs('g1', 's1', 'p1');
        expect(result).toHaveLength(0);
    });
});
//# sourceMappingURL=session.service.test.js.map