import { eq } from 'drizzle-orm';
import type { Credentials, PublicPlayer } from '@modules/auth/auth.entity.js';
import type {
  AuthSession,
  AuthSessionRepository,
  CredentialsRepository,
} from '@modules/auth/auth.repository.js';
import { db } from '../index.js';
import { authSession, player } from '../schema.js';

type CredentialRow = typeof player.$inferSelect;

function toCredentials(row: CredentialRow): Credentials {
  return {
    id: row.id,
    name: row.name,
    passwordHash: row.passwordHash,
  };
}

function toPublicPlayer(row: CredentialRow): PublicPlayer {
  return { id: row.id, name: row.name };
}

export function credentialsRepository(): CredentialsRepository {
  return {
    async findByUsername(name: string): Promise<Credentials | null> {
      const [row] = await db
        .select()
        .from(player)
        .where(eq(player.name, name))
        .limit(1);

      return row ? toCredentials(row) : null;
    },

    async create(input: {
      name: string;
      passwordHash: string;
    }): Promise<PublicPlayer> {
      const [row] = await db
        .insert(player)
        .values({ name: input.name, passwordHash: input.passwordHash })
        .returning();

      if (!row) throw new Error('Falha ao criar o jogador.');

      return toPublicPlayer(row);
    },
  };
}

export function authSessionRepository(): AuthSessionRepository {
  return {
    async create(input): Promise<void> {
      await db.insert(authSession).values({
        playerId: input.playerId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      });
    },

    async findByHash(tokenHash: string): Promise<AuthSession | null> {
      const [row] = await db
        .select({
          playerId: authSession.playerId,
          name: player.name,
          expiresAt: authSession.expiresAt,
          lastUsedAt: authSession.lastUsedAt,
        })
        .from(authSession)
        .innerJoin(player, eq(authSession.playerId, player.id))
        .where(eq(authSession.tokenHash, tokenHash))
        .limit(1);

      if (!row) return null;

      return {
        playerId: row.playerId,
        name: row.name,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
      };
    },

    async deleteByHash(tokenHash: string): Promise<void> {
      await db.delete(authSession).where(eq(authSession.tokenHash, tokenHash));
    },

    async deleteByPlayerId(playerId: string): Promise<void> {
      await db.delete(authSession).where(eq(authSession.playerId, playerId));
    },
  };
}
