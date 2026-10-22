import { and, desc, eq, sql } from 'drizzle-orm';
import type { ChatMessage } from '@modules/chat/chat.entity.js';
import {
  type TestDeclaredPayload,
  TestDeclaredPayloadSchema,
} from '@modules/session/session.entity.js';
import {
  ChatAlreadyRolledError,
  ChatSessionNotFoundError,
} from '@modules/chat/chat.errors.js';
import type {
  AppendChatMessageInput,
  AppendSessionLogInput,
  ChatMessageRepository,
  ChatSessionRef,
} from '@modules/chat/chat.repository.js';
import { db } from '../index.js';
import { isUniqueViolation } from '../pg-errors.js';
import { session, sessionLog } from '../schema.js';
import { insertSessionLog } from './session-log.js';

type SessionLogRow = typeof sessionLog.$inferSelect;

function parseBody(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const text: unknown = Reflect.get(payload, 'text');

  return typeof text === 'string' ? text : '';
}

const TEST_ROLL_UNIQUE = 'session_log_test_roll_unique';

function toChatMessage(row: SessionLogRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    playerId: row.playerId,
    body: parseBody(row.payload),
    createdAt: row.createdAt,
  };
}

export function chatMessageRepository(): ChatMessageRepository {
  return {
    async findSession(sessionId: string): Promise<ChatSessionRef | null> {
      const [row] = await db
        .select({ id: session.id, gameId: session.gameId })
        .from(session)
        .where(eq(session.id, sessionId))
        .limit(1);

      return row ?? null;
    },

    async appendChat(input: AppendChatMessageInput): Promise<ChatMessage> {
      const [row] = await db
        .insert(sessionLog)
        .values({
          sessionId: input.sessionId,
          playerId: input.playerId,
          eventType: 'chat',
          payload: { text: input.body },
        })
        .returning();
      if (!row) throw new ChatSessionNotFoundError();

      return toChatMessage(row);
    },

    async appendLog(input: AppendSessionLogInput): Promise<void> {
      try {
        await insertSessionLog(db, input);
      } catch (error) {
        if (isUniqueViolation(error, TEST_ROLL_UNIQUE)) {
          throw new ChatAlreadyRolledError();
        }
        throw error;
      }
    },

    async listRecentChat(
      sessionId: string,
      limit: number,
    ): Promise<ChatMessage[]> {
      const rows = await db
        .select()
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'chat'),
          ),
        )
        .orderBy(desc(sessionLog.createdAt))
        .limit(limit);

      return rows.map(toChatMessage).reverse();
    },

    async findTestById(
      sessionId: string,
      testId: string,
    ): Promise<TestDeclaredPayload | null> {
      const [row] = await db
        .select({ payload: sessionLog.payload })
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'test_declared'),
            sql`${sessionLog.payload}->>'testId' = ${testId}`,
          ),
        )
        .limit(1);
      if (!row) return null;

      const parsed = TestDeclaredPayloadSchema.safeParse(row.payload);
      if (!parsed.success) return null;

      return parsed.data;
    },

    async findLatestTest(
      sessionId: string,
    ): Promise<TestDeclaredPayload | null> {
      const [row] = await db
        .select({ payload: sessionLog.payload })
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'test_declared'),
          ),
        )
        .orderBy(desc(sessionLog.createdAt))
        .limit(1);
      if (!row) return null;

      const parsed = TestDeclaredPayloadSchema.safeParse(row.payload);
      if (!parsed.success) return null;

      return parsed.data;
    },

    async isTestClosed(sessionId: string, testId: string): Promise<boolean> {
      const [row] = await db
        .select({ id: sessionLog.id })
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'test_closed'),
            sql`${sessionLog.payload}->>'testId' = ${testId}`,
          ),
        )
        .limit(1);

      return row !== undefined;
    },

    async hasRolledTest(
      sessionId: string,
      testId: string,
      characterId: string,
    ): Promise<boolean> {
      const [row] = await db
        .select({ id: sessionLog.id })
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'dice_roll'),
            sql`${sessionLog.payload}->>'testId' = ${testId}`,
            sql`${sessionLog.payload}->>'characterId' = ${characterId}`,
          ),
        )
        .limit(1);

      return row !== undefined;
    },

    async listTestRollers(
      sessionId: string,
      testId: string,
    ): Promise<string[]> {
      const rows = await db
        .selectDistinct({
          characterId: sql<string>`${sessionLog.payload}->>'characterId'`,
        })
        .from(sessionLog)
        .where(
          and(
            eq(sessionLog.sessionId, sessionId),
            eq(sessionLog.eventType, 'dice_roll'),
            sql`${sessionLog.payload}->>'testId' = ${testId}`,
            sql`${sessionLog.payload}->>'characterId' IS NOT NULL`,
          ),
        );

      return rows.map((row) => row.characterId);
    },
  };
}
