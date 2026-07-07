import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type { UpdatePlayerBody } from './player.schemas.js';

interface PlayerRepo {
  findById(id: string): Promise<{ id: string; name: string; createdAt?: Date } | null>;
  findByName(name: string): Promise<{ id: string; name: string } | null>;
  update(id: string, data: { name?: string; passwordHash?: string }): Promise<{ id: string; name: string; createdAt?: Date }>;
}

interface HashService {
  hashPassword(password: string): Promise<string>;
}

export class PlayerService {
  constructor(
    private readonly repo: PlayerRepo,
    private readonly hashService: HashService,
  ) {}

  async getById(id: string) {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundError('Player');
    return found;
  }

  async update(id: string, body: UpdatePlayerBody) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Player');

    if (body.name && body.name !== existing.name) {
      const taken = await this.repo.findByName(body.name);
      if (taken) throw new ConflictError('Player name');
    }

    const data: { name?: string; passwordHash?: string } = {};
    if (body.name) data.name = body.name;
    if (body.password) data.passwordHash = await this.hashService.hashPassword(body.password);

    return this.repo.update(id, data);
  }
}
