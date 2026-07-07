import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
export class GameService {
    repo;
    inviteCodeService;
    constructor(repo, inviteCodeService) {
        this.repo = repo;
        this.inviteCodeService = inviteCodeService;
    }
    async create(body, masterId) {
        const inviteCode = this.inviteCodeService.generate();
        const data = {
            masterId,
            inviteCode,
            name: body.name,
        };
        if (body.description)
            data.description = body.description;
        if (body.imageUrl)
            data.imageUrl = body.imageUrl;
        return this.repo.create(data);
    }
    async getById(id, requesterId) {
        const game = await this.repo.findById(id);
        if (!game)
            throw new NotFoundError('Game');
        const isMaster = game.masterId === requesterId;
        if (!isMaster) {
            const inGame = await this.repo.isPlayerInGame(id, requesterId);
            if (!inGame)
                throw new ForbiddenError();
        }
        return game;
    }
    async getMine(playerId, pagination = { limit: 20, offset: 0 }) {
        const [mastered, joined] = await Promise.all([
            this.repo.findByMasterId(playerId),
            this.repo.findByPlayerId(playerId, pagination),
        ]);
        const seen = new Set();
        return [...mastered, ...joined].filter((g) => {
            if (seen.has(g.id))
                return false;
            seen.add(g.id);
            return true;
        });
    }
    async getMastered(masterId) {
        return this.repo.findByMasterId(masterId);
    }
    async join(inviteCode, playerId) {
        const game = await this.repo.findByInviteCode(inviteCode);
        if (!game)
            throw new NotFoundError('Invite code');
        const alreadyIn = await this.repo.isPlayerInGame(game.id, playerId);
        if (alreadyIn)
            throw new ConflictError('Player already in game');
        await this.repo.addPlayer(game.id, playerId);
        return game;
    }
    async update(id, body, requesterId) {
        const game = await this.repo.findById(id);
        if (!game)
            throw new NotFoundError('Game');
        if (game.masterId !== requesterId)
            throw new ForbiddenError();
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.description !== undefined)
            data.description = body.description;
        if (body.imageUrl !== undefined)
            data.imageUrl = body.imageUrl;
        if (body.isActive !== undefined)
            data.isActive = body.isActive;
        return this.repo.update(id, data);
    }
    async delete(id, requesterId) {
        const game = await this.repo.findById(id);
        if (!game)
            throw new NotFoundError('Game');
        if (game.masterId !== requesterId)
            throw new ForbiddenError();
        await this.repo.delete(id);
    }
    async leave(gameId, playerId) {
        const game = await this.repo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        if (game.masterId === playerId)
            throw new ForbiddenError();
        await this.repo.removePlayer(gameId, playerId);
    }
    async getPlayers(gameId, requesterId) {
        const game = await this.repo.findById(gameId);
        if (!game)
            throw new NotFoundError('Game');
        const isMaster = game.masterId === requesterId;
        if (!isMaster) {
            const inGame = await this.repo.isPlayerInGame(gameId, requesterId);
            if (!inGame)
                throw new ForbiddenError();
        }
        return this.repo.getPlayers(gameId);
    }
}
//# sourceMappingURL=game.service.js.map