import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { calcBExp, calcMaxEffort, calcMaxHp } from './character.stats.js';
export class CharacterService {
    repo;
    gameRepo;
    constructor(repo, gameRepo) {
        this.repo = repo;
        this.gameRepo = gameRepo;
    }
    async create(body, playerId) {
        const inGame = await this.gameRepo.isPlayerInGame(body.gameId, playerId);
        if (!inGame)
            throw new ForbiddenError();
        const level = body.level ?? 1;
        const con = body.constitution ?? 0;
        const profVitality = body.profConstitution ?? 0;
        const profWillpower = body.profConstitution ?? 0;
        const maxHp = calcMaxHp(level, con, profVitality);
        const maxEffort = calcMaxEffort(con, profWillpower);
        const bExp = calcBExp(level);
        return this.repo.create({
            ...body,
            playerId,
            maxHp,
            currentHp: maxHp,
            maxEffort,
            currentEffort: maxEffort,
            bExp,
        });
    }
    async getById(id, requesterId) {
        const character = await this.repo.findById(id);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return character;
    }
    async getMine(playerId, pagination = { limit: 20, offset: 0 }) {
        return this.repo.findByPlayerId(playerId, pagination);
    }
    async getByGame(gameId) {
        return this.repo.findByGameId(gameId);
    }
    async update(id, body, requesterId) {
        const character = await this.repo.findById(id);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        const updates = { ...body };
        const level = (body.level ?? character.level ?? 1);
        const con = (body.constitution ?? character.constitution ?? 0);
        const profVitality = (body.profConstitution ?? character.profConstitution ?? 0);
        updates.maxHp = calcMaxHp(level, con, profVitality);
        updates.maxEffort = calcMaxEffort(con, profVitality);
        updates.bExp = calcBExp(level);
        return this.repo.update(id, updates);
    }
    async delete(id, requesterId) {
        const character = await this.repo.findById(id);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        await this.repo.delete(id);
    }
    async createItem(characterId, body, requesterId) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return this.repo.createItem(characterId, body);
    }
    async updateItem(characterId, itemId, body, requesterId) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return this.repo.updateItem(itemId, body);
    }
    async deleteItem(characterId, itemId, requesterId) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        await this.repo.deleteItem(itemId);
    }
    async getItems(characterId, requesterId) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return this.repo.findItems(characterId);
    }
    async getSkills(characterId, requesterId) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return this.repo.findSkills(characterId);
    }
    async upsertSkill(characterId, requesterId, skill, points) {
        const character = await this.repo.findById(characterId);
        if (!character)
            throw new NotFoundError('Character');
        if (character.playerId !== requesterId)
            throw new ForbiddenError();
        return this.repo.upsertSkill(characterId, skill, points);
    }
}
//# sourceMappingURL=character.service.js.map