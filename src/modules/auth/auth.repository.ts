import type { Credentials, PublicPlayer } from './auth.entity.js';

export interface CredentialsRepository {
  findByUsername(name: string): Promise<Credentials | null>;
  create(input: { name: string; passwordHash: string }): Promise<PublicPlayer>;
}

export interface RotateSessionInput {
  presentedHash: string;
  successorHash: string;
  successorExpiresAt: Date;
  now: Date;
  graceWindowMs: number;
}

export type RotationOutcome =
  | { status: 'issued'; playerId: string; name: string }
  | { status: 'unknown' | 'expired' | 'revoked' | 'reused' };

export interface AuthSessionRepository {
  create(input: {
    playerId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  rotate(input: RotateSessionInput): Promise<RotationOutcome>;
  deleteByPlayerId(playerId: string): Promise<void>;
}
