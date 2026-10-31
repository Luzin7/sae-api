import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import type { Credentials, PublicPlayer } from '@modules/auth/auth.entity.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
  RotateSessionInput,
  RotationOutcome,
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isInsideGraceWindow(usedAt: Date, input: RotateSessionInput): boolean {
  return input.now.getTime() - usedAt.getTime() <= input.graceWindowMs;
}

async function insertSuccessor(
  tx: Tx,
  parent: { playerId: string; familyId: string },
  input: RotateSessionInput,
): Promise<string> {
  const [successor] = await tx
    .insert(authSession)
    .values({
      playerId: parent.playerId,
      familyId: parent.familyId,
      tokenHash: input.successorHash,
      expiresAt: input.successorExpiresAt,
    })
    .returning({ id: authSession.id });
  if (!successor) throw new Error('Falha ao emitir o refresh token.');

  return successor.id;
}

async function pruneExpired(
  tx: Tx,
  playerId: string,
  now: Date,
): Promise<void> {
  await tx
    .delete(authSession)
    .where(
      and(eq(authSession.playerId, playerId), lte(authSession.expiresAt, now)),
    );
}

async function issued(tx: Tx, playerId: string): Promise<RotationOutcome> {
  const [owner] = await tx
    .select({ name: player.name })
    .from(player)
    .where(eq(player.id, playerId));
  if (!owner) return { status: 'unknown' };

  return { status: 'issued', playerId, name: owner.name };
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

    async rotate(input: RotateSessionInput): Promise<RotationOutcome> {
      return db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(authSession)
          .set({ usedAt: input.now, lastUsedAt: input.now })
          .where(
            and(
              eq(authSession.tokenHash, input.presentedHash),
              isNull(authSession.usedAt),
              isNull(authSession.revokedAt),
              gt(authSession.expiresAt, input.now),
            ),
          )
          .returning({
            id: authSession.id,
            playerId: authSession.playerId,
            familyId: authSession.familyId,
          });

        if (claimed) {
          const successorId = await insertSuccessor(tx, claimed, input);
          await tx
            .update(authSession)
            .set({ replacedById: successorId })
            .where(eq(authSession.id, claimed.id));
          await pruneExpired(tx, claimed.playerId, input.now);

          return issued(tx, claimed.playerId);
        }

        const [row] = await tx
          .select({
            playerId: authSession.playerId,
            familyId: authSession.familyId,
            expiresAt: authSession.expiresAt,
            usedAt: authSession.usedAt,
            revokedAt: authSession.revokedAt,
          })
          .from(authSession)
          .where(eq(authSession.tokenHash, input.presentedHash));

        if (!row) return { status: 'unknown' };
        if (row.revokedAt) return { status: 'revoked' };
        if (row.expiresAt.getTime() <= input.now.getTime()) {
          return { status: 'expired' };
        }
        if (!row.usedAt || !isInsideGraceWindow(row.usedAt, input)) {
          await tx
            .update(authSession)
            .set({ revokedAt: input.now })
            .where(
              and(
                eq(authSession.familyId, row.familyId),
                isNull(authSession.revokedAt),
              ),
            );

          return { status: 'reused' };
        }

        await insertSuccessor(tx, row, input);

        return issued(tx, row.playerId);
      });
    },

    async deleteByPlayerId(playerId: string): Promise<void> {
      await db.delete(authSession).where(eq(authSession.playerId, playerId));
    },
  };
}
