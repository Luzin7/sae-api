import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
export class SessionService {
    repo;
    gameRepo;
    constructor(repo, gameRepo) {
        this.repo = repo;
        this.gameRepo = gameRepo;
    }
    async start(gameId, requesterId) {
        const game = await this.gameRepo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        if (game.masterId !== requesterId)
            throw new ForbiddenError();
        const existing = await this.repo.findActiveByGameId(gameId);
        if (existing)
            throw new ConflictError('Session');
        return this.repo.create(gameId);
    }
    async end(gameId, requesterId) {
        const game = await this.gameRepo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        if (game.masterId !== requesterId)
            throw new ForbiddenError();
        const active = await this.repo.findActiveByGameId(gameId);
        if (!active)
            throw new NotFoundError('Session');
        return this.repo.endSession(active.id);
    }
    async getActive(gameId, requesterId) {
        const game = await this.gameRepo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        const isMaster = game.masterId === requesterId;
        if (!isMaster) {
            const inGame = await this.gameRepo.isPlayerInGame(gameId, requesterId);
            if (!inGame)
                throw new ForbiddenError();
        }
        return this.repo.findActiveByGameId(gameId);
    }
    async getLogs(gameId, sessionId, requesterId) {
        const game = await this.gameRepo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        const isMaster = game.masterId === requesterId;
        if (!isMaster) {
            const inGame = await this.gameRepo.isPlayerInGame(gameId, requesterId);
            if (!inGame)
                throw new ForbiddenError();
        }
        return this.repo.findLogsBySessionId(sessionId);
    }
}
//# sourceMappingURL=session.service.js.map