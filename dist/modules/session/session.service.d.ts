interface SessionData {
    id: string;
    gameId: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
}
interface GameData {
    id: string;
    masterId: string;
}
interface SessionLogData {
    id: string;
    sessionId: string;
    playerId: string | null;
    eventType: string;
    payload: unknown;
    createdAt: Date;
}
interface SessionRepo {
    create(gameId: string): Promise<SessionData>;
    findActiveByGameId(gameId: string): Promise<SessionData | null>;
    endSession(sessionId: string): Promise<SessionData>;
    findLogsBySessionId(sessionId: string): Promise<SessionLogData[]>;
}
interface GameRepo {
    findById(id: string): Promise<GameData | null>;
    isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}
export declare class SessionService {
    private readonly repo;
    private readonly gameRepo;
    constructor(repo: SessionRepo, gameRepo: GameRepo);
    start(gameId: string, requesterId: string): Promise<SessionData>;
    end(gameId: string, requesterId: string): Promise<SessionData>;
    getActive(gameId: string, requesterId: string): Promise<SessionData | null>;
    getLogs(gameId: string, sessionId: string, requesterId: string): Promise<SessionLogData[]>;
}
export {};
//# sourceMappingURL=session.service.d.ts.map