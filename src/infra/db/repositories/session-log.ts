import type { Database } from '../index.js';
import type { AppendSessionLogInput } from '@modules/chat/chat.repository.js';
import { sessionLog } from '../schema.js';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** The only place the `session_log` insert is built, for db and transactions. */
export type LogWriter = Database | Transaction;

export async function insertSessionLog(
  writer: LogWriter,
  input: AppendSessionLogInput,
): Promise<void> {
  await writer.insert(sessionLog).values({
    sessionId: input.sessionId,
    playerId: input.playerId,
    eventType: input.eventType,
    payload: input.payload,
  });
}
