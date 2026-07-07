import type { LoginBody, RegisterBody } from './auth.schemas.js';
interface PlayerRepo {
    findByName(name: string): Promise<{
        id: string;
        name: string;
        passwordHash?: string;
    } | null>;
    create(data: {
        name: string;
        passwordHash: string;
    }): Promise<{
        id: string;
        name: string;
    }>;
}
interface RefreshTokenRepo {
    create(data: {
        playerId: string;
        token: string;
        expiresAt: Date;
    }): Promise<{
        token: string;
    }>;
    findByToken(token: string): Promise<{
        token: string;
        expiresAt: Date;
        playerId: string;
        player?: {
            id: string;
            name: string;
        };
    } | null>;
    deleteByToken(token: string): Promise<void>;
    deleteByPlayerId(playerId: string): Promise<void>;
}
interface HashService {
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
}
interface JwtService {
    sign(payload: {
        sub: string;
        name: string;
    }): string;
}
interface AuthResult {
    player: {
        id: string;
        name: string;
    };
    accessToken: string;
    refreshToken?: string;
}
export declare class AuthService {
    private readonly playerRepo;
    private readonly refreshTokenRepo;
    private readonly hashService;
    private readonly jwtService;
    constructor(playerRepo: PlayerRepo, refreshTokenRepo: RefreshTokenRepo, hashService: HashService, jwtService: JwtService);
    register(body: RegisterBody): Promise<AuthResult>;
    login(body: LoginBody): Promise<AuthResult>;
    refresh(token: string): Promise<{
        accessToken: string;
    }>;
    logout(playerId: string): Promise<void>;
    private createRefreshToken;
}
export {};
//# sourceMappingURL=auth.service.d.ts.map