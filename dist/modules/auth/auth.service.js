import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export class AuthService {
    playerRepo;
    refreshTokenRepo;
    hashService;
    jwtService;
    constructor(playerRepo, refreshTokenRepo, hashService, jwtService) {
        this.playerRepo = playerRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.hashService = hashService;
        this.jwtService = jwtService;
    }
    async register(body) {
        const existing = await this.playerRepo.findByName(body.name);
        if (existing)
            throw new ConflictError('Player');
        const passwordHash = await this.hashService.hashPassword(body.password);
        const player = await this.playerRepo.create({ name: body.name, passwordHash });
        const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });
        const { token: refreshToken } = await this.createRefreshToken(player.id);
        return { player, accessToken, refreshToken };
    }
    async login(body) {
        const player = await this.playerRepo.findByName(body.name);
        if (!player)
            throw new NotFoundError('Player');
        const valid = await this.hashService.verifyPassword(body.password, player.passwordHash ?? '');
        if (!valid)
            throw new UnauthorizedError();
        const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });
        const { token: refreshToken } = await this.createRefreshToken(player.id);
        return { player: { id: player.id, name: player.name }, accessToken, refreshToken };
    }
    async refresh(token) {
        const stored = await this.refreshTokenRepo.findByToken(token);
        if (!stored)
            throw new UnauthorizedError();
        if (stored.expiresAt < new Date())
            throw new UnauthorizedError();
        const player = stored.player ?? { id: stored.playerId, name: '' };
        const accessToken = this.jwtService.sign({ sub: player.id, name: player.name });
        return { accessToken };
    }
    async logout(playerId) {
        await this.refreshTokenRepo.deleteByPlayerId(playerId);
    }
    async createRefreshToken(playerId) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
        return this.refreshTokenRepo.create({ playerId, token, expiresAt });
    }
}
//# sourceMappingURL=auth.service.js.map