import { and, desc, eq } from 'drizzle-orm';
import type { ChatMessage } from '@modules/chat/chat.entity.js';
import { ChatSessionNotFoundError } from '@modules/chat/chat.errors.js';
import type {
  AppendChatMessageInput,
  AppendSessionLogInput,
  ChatMessageRepository,
  ChatSessionRef,
} from '@modules/chat/chat.repository.js';
import { db } from '../index.js';
import { session, sessionLog } from '../schema.js';

type SessionLogRow = typeof sessionLog.$inferSelect;

function parseBody(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const text: unknown = Reflect.get(payload, 'text');

  return typeof text === 'string' ? text : '';
}

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
      await db.insert(sessionLog).values({
        sessionId: input.sessionId,
        playerId: input.playerId,
        eventType: input.eventType,
        payload: input.payload,
      });
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
  };
}
