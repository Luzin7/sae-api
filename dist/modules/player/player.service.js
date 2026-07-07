import { ConflictError, NotFoundError } from '../../lib/errors.js';
export class PlayerService {
    repo;
    hashService;
    constructor(repo, hashService) {
        this.repo = repo;
        this.hashService = hashService;
    }
    async getById(id) {
        const found = await this.repo.findById(id);
        if (!found)
            throw new NotFoundError('Player');
        return found;
    }
    async update(id, body) {
        const existing = await this.repo.findById(id);
        if (!existing)
            throw new NotFoundError('Player');
        if (body.name && body.name !== existing.name) {
            const taken = await this.repo.findByName(body.name);
            if (taken)
                throw new ConflictError('Player name');
        }
        const data = {};
        if (body.name)
            data.name = body.name;
        if (body.password)
            data.passwordHash = await this.hashService.hashPassword(body.password);
        return this.repo.update(id, data);
    }
}
//# sourceMappingURL=player.service.js.map