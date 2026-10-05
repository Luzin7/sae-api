import type { Credentials, PublicPlayer } from './auth.entity.js';

export interface CredentialsRepository {
  findByUsername(name: string): Promise<Credentials | null>;
  create(input: { name: string; passwordHash: string }): Promise<PublicPlayer>;
}

export interface AuthSession {
  playerId: string;
  name: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
}

export interface AuthSessionRepository {
  create(input: {
    playerId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findByHash(tokenHash: string): Promise<AuthSession | null>;
  deleteByHash(tokenHash: string): Promise<void>;
  deleteByPlayerId(playerId: string): Promise<void>;
}
