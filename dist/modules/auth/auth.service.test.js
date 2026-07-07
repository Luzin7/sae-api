import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
const mockPlayerRepo = {
    findByName: vi.fn(),
    create: vi.fn(),
};
const mockRefreshTokenRepo = {
    create: vi.fn(),
    findByToken: vi.fn(),
    deleteByToken: vi.fn(),
    deleteByPlayerId: vi.fn(),
};
const mockHash = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
};
const mockJwt = {
    sign: vi.fn(),
};
const service = new AuthService(mockPlayerRepo, mockRefreshTokenRepo, mockHash, mockJwt);
beforeEach(() => vi.clearAllMocks());
describe('AuthService.register', () => {
    it('throws ConflictError when name is taken', async () => {
        mockPlayerRepo.findByName.mockResolvedValue({ id: '1', name: 'existing' });
        await expect(service.register({ name: 'existing', password: 'pass' })).rejects.toThrow(ConflictError);
    });
    it('creates player and returns auth response', async () => {
        mockPlayerRepo.findByName.mockResolvedValue(null);
        mockHash.hashPassword.mockResolvedValue('hashed');
        mockPlayerRepo.create.mockResolvedValue({ id: 'uuid-1', name: 'Alice' });
        mockRefreshTokenRepo.create.mockResolvedValue({ token: 'refresh-token' });
        mockJwt.sign.mockReturnValue('access-token');
        const result = await service.register({ name: 'Alice', password: 'secret123' });
        expect(result.player.name).toBe('Alice');
        expect(result.accessToken).toBe('access-token');
        expect(mockHash.hashPassword).toHaveBeenCalledWith('secret123');
    });
});
describe('AuthService.login', () => {
    it('throws NotFoundError when player does not exist', async () => {
        mockPlayerRepo.findByName.mockResolvedValue(null);
        await expect(service.login({ name: 'nobody', password: 'x' })).rejects.toThrow(NotFoundError);
    });
    it('throws UnauthorizedError when password is wrong', async () => {
        mockPlayerRepo.findByName.mockResolvedValue({ id: '1', name: 'Alice', passwordHash: 'hash' });
        mockHash.verifyPassword.mockResolvedValue(false);
        await expect(service.login({ name: 'Alice', password: 'wrong' })).rejects.toThrow(UnauthorizedError);
    });
    it('returns accessToken and refreshToken on success', async () => {
        mockPlayerRepo.findByName.mockResolvedValue({ id: '1', name: 'Alice', passwordHash: 'hash' });
        mockHash.verifyPassword.mockResolvedValue(true);
        mockRefreshTokenRepo.create.mockResolvedValue({ token: 'refresh-token' });
        mockJwt.sign.mockReturnValue('access-token');
        const result = await service.login({ name: 'Alice', password: 'correct' });
        expect(result.accessToken).toBe('access-token');
        expect(result.player.name).toBe('Alice');
    });
});
describe('AuthService.refresh', () => {
    it('throws UnauthorizedError when token not found', async () => {
        mockRefreshTokenRepo.findByToken.mockResolvedValue(null);
        await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedError);
    });
    it('throws UnauthorizedError when token is expired', async () => {
        mockRefreshTokenRepo.findByToken.mockResolvedValue({
            token: 'tok',
            expiresAt: new Date(Date.now() - 1000),
            playerId: 'p1',
        });
        await expect(service.refresh('tok')).rejects.toThrow(UnauthorizedError);
    });
    it('returns new accessToken on valid refresh token', async () => {
        mockRefreshTokenRepo.findByToken.mockResolvedValue({
            token: 'valid',
            expiresAt: new Date(Date.now() + 100_000),
            playerId: 'p1',
            player: { id: 'p1', name: 'Alice' },
        });
        mockJwt.sign.mockReturnValue('new-token');
        const result = await service.refresh('valid');
        expect(result.accessToken).toBe('new-token');
    });
});
//# sourceMappingURL=auth.service.test.js.map