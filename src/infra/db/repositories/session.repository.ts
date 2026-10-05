import { and, desc, eq } from 'drizzle-orm';
import {
  type AppendLogInput,
  type GameSession,
  type Page,
  parseSessionEventPayload,
  type SessionLog,
} from '@modules/session/session.entity.js';
import { SessionNotFoundError } from '@modules/session/session.errors.js';
import type { SessionRepository } from '@modules/session/session.repository.js';
import { db } from '../index.js';
import { session, sessionLog } from '../schema.js';

type SessionRow = typeof session.$inferSelect;
type SessionLogRow = typeof sessionLog.$inferSelect;

function toSession(row: SessionRow): GameSession {
  return {
    id: row.id,
    gameId: row.gameId,
    isActive: row.isActive,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

function toLog(row: SessionLogRow): SessionLog {
  return {
    id: row.id,
    sessionId: row.sessionId,
    playerId: row.playerId,
    eventType: row.eventType,
    payload: parseSessionEventPayload(row.eventType, row.payload),
    createdAt: row.createdAt,
  };
}

export function sessionRepository(): SessionRepository {
  return {
    async create(gameId: string): Promise<GameSession> {
      const [row] = await db.insert(session).values({ gameId }).returning();
      if (!row) throw new SessionNotFoundError();

      return toSession(row);
    },

    async findActiveByGame(gameId: string): Promise<GameSession | null> {
      const [row] = await db
        .select()
        .from(session)
        .where(and(eq(session.gameId, gameId), eq(session.isActive, true)))
        .limit(1);

      return row ? toSession(row) : null;
    },

    async findById(sessionId: string): Promise<GameSession | null> {
      const [row] = await db
        .select()
        .from(session)
        .where(eq(session.id, sessionId))
        .limit(1);

      return row ? toSession(row) : null;
    },

    async end(sessionId: string): Promise<GameSession> {
      const [row] = await db
        .update(session)
        .set({ isActive: false, endedAt: new Date() })
        .where(eq(session.id, sessionId))
        .returning();
      if (!row) throw new SessionNotFoundError();

      return toSession(row);
    },

    async appendLog(input: AppendLogInput): Promise<SessionLog> {
      const [row] = await db
        .insert(sessionLog)
        .values({
          sessionId: input.sessionId,
          playerId: input.playerId,
          eventType: input.eventType,
          payload: input.payload,
        })
        .returning();
      if (!row) throw new SessionNotFoundError();

      return toLog(row);
    },

    async listLogs(sessionId: string, page: Page): Promise<SessionLog[]> {
      const rows = await db
        .select()
        .from(sessionLog)
        .where(eq(sessionLog.sessionId, sessionId))
        .orderBy(desc(sessionLog.createdAt))
        .limit(page.limit)
        .offset(page.offset);

      return rows.map(toLog);
    },
  };
}
