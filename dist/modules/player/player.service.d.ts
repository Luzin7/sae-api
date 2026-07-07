import type { UpdatePlayerBody } from './player.schemas.js';
interface PlayerRepo {
    findById(id: string): Promise<{
        id: string;
        name: string;
        createdAt?: Date;
    } | null>;
    findByName(name: string): Promise<{
        id: string;
        name: string;
    } | null>;
    update(id: string, data: {
        name?: string;
        passwordHash?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt?: Date;
    }>;
}
interface HashService {
    hashPassword(password: string): Promise<string>;
}
export declare class PlayerService {
    private readonly repo;
    private readonly hashService;
    constructor(repo: PlayerRepo, hashService: HashService);
    getById(id: string): Promise<{
        id: string;
        name: string;
        createdAt?: Date;
    }>;
    update(id: string, body: UpdatePlayerBody): Promise<{
        id: string;
        name: string;
        createdAt?: Date;
    }>;
}
export {};
//# sourceMappingURL=player.service.d.ts.map