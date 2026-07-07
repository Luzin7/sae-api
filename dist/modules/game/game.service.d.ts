import type { CreateGameBody, UpdateGameBody } from './game.schemas.js';
interface PaginationOptions {
    limit: number;
    offset: number;
}
interface GameRepo {
    create(data: {
        masterId: string;
        name: string;
        description?: string;
        imageUrl?: string;
        inviteCode: string;
    }): Promise<{
        id: string;
        name: string;
        masterId: string;
        inviteCode: string;
    }>;
    findById(id: string): Promise<{
        id: string;
        name: string;
        masterId: string;
        inviteCode?: string;
    } | null>;
    findByInviteCode(code: string): Promise<{
        id: string;
        masterId: string;
    } | null>;
    findByMasterId(masterId: string): Promise<{
        id: string;
        name: string;
    }[]>;
    findByPlayerId(playerId: string, pagination: PaginationOptions): Promise<{
        id: string;
        name: string;
    }[]>;
    update(id: string, data: Partial<{
        name: string;
        description: string;
        imageUrl: string;
        isActive: boolean;
    }>): Promise<{
        id: string;
        name: string;
    }>;
    delete(id: string): Promise<void>;
    addPlayer(gameId: string, playerId: string): Promise<void>;
    removePlayer(gameId: string, playerId: string): Promise<void>;
    getPlayers(gameId: string): Promise<{
        id: string;
        name: string;
    }[]>;
    isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}
interface InviteCodeService {
    generate(): string;
}
export declare class GameService {
    private readonly repo;
    private readonly inviteCodeService;
    constructor(repo: GameRepo, inviteCodeService: InviteCodeService);
    create(body: CreateGameBody, masterId: string): Promise<{
        id: string;
        name: string;
        masterId: string;
        inviteCode: string;
    }>;
    getById(id: string, requesterId: string): Promise<{
        id: string;
        name: string;
        masterId: string;
        inviteCode?: string;
    }>;
    getMine(playerId: string, pagination?: PaginationOptions): Promise<{
        id: string;
        name: string;
    }[]>;
    getMastered(masterId: string): Promise<{
        id: string;
        name: string;
    }[]>;
    join(inviteCode: string, playerId: string): Promise<{
        id: string;
        masterId: string;
    }>;
    update(id: string, body: UpdateGameBody, requesterId: string): Promise<{
        id: string;
        name: string;
    }>;
    delete(id: string, requesterId: string): Promise<void>;
    leave(gameId: string, playerId: string): Promise<void>;
    getPlayers(gameId: string, requesterId: string): Promise<{
        id: string;
        name: string;
    }[]>;
}
export {};
//# sourceMappingURL=game.service.d.ts.map