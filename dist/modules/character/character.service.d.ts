import type { CreateCharacterBody, CreateItemBody, UpdateCharacterBody, UpdateItemBody } from './character.schemas.js';
interface CharacterData {
    id: string;
    playerId: string;
    nickname: string;
    maxHp?: number;
    maxEffort?: number;
    bExp?: number;
    level?: number;
    constitution?: number;
    profConstitution?: number;
    [key: string]: unknown;
}
interface CharacterRepo {
    create(data: Record<string, unknown>): Promise<CharacterData>;
    findById(id: string): Promise<CharacterData | null>;
    findByPlayerId(playerId: string, pagination: {
        limit: number;
        offset: number;
    }): Promise<CharacterData[]>;
    findByGameId(gameId: string): Promise<CharacterData[]>;
    update(id: string, data: Record<string, unknown>): Promise<CharacterData>;
    delete(id: string): Promise<void>;
    createItem(characterId: string, data: CreateItemBody): Promise<unknown>;
    updateItem(itemId: string, data: UpdateItemBody): Promise<unknown>;
    deleteItem(itemId: string): Promise<void>;
    findItems(characterId: string): Promise<unknown[]>;
    findSkills(characterId: string): Promise<unknown[]>;
    upsertSkill(characterId: string, skill: string, points: number): Promise<unknown>;
}
interface GameRepo {
    isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}
export declare class CharacterService {
    private readonly repo;
    private readonly gameRepo;
    constructor(repo: CharacterRepo, gameRepo: GameRepo);
    create(body: CreateCharacterBody & Record<string, unknown>, playerId: string): Promise<CharacterData>;
    getById(id: string, requesterId: string): Promise<CharacterData>;
    getMine(playerId: string, pagination?: {
        limit: number;
        offset: number;
    }): Promise<CharacterData[]>;
    getByGame(gameId: string): Promise<CharacterData[]>;
    update(id: string, body: UpdateCharacterBody, requesterId: string): Promise<CharacterData>;
    delete(id: string, requesterId: string): Promise<void>;
    createItem(characterId: string, body: CreateItemBody, requesterId: string): Promise<unknown>;
    updateItem(characterId: string, itemId: string, body: UpdateItemBody, requesterId: string): Promise<unknown>;
    deleteItem(characterId: string, itemId: string, requesterId: string): Promise<void>;
    getItems(characterId: string, requesterId: string): Promise<unknown[]>;
    getSkills(characterId: string, requesterId: string): Promise<unknown[]>;
    upsertSkill(characterId: string, requesterId: string, skill: string, points: number): Promise<unknown>;
}
export {};
//# sourceMappingURL=character.service.d.ts.map