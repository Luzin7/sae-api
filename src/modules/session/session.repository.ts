import type {
  AppendLogInput,
  GameSession,
  Page,
  SessionLog,
} from './session.entity.js';

export interface SessionRepository {
  create(gameId: string): Promise<GameSession>;
  findActiveByGame(gameId: string): Promise<GameSession | null>;
  findById(sessionId: string): Promise<GameSession | null>;
  end(sessionId: string): Promise<GameSession>;
  appendLog(input: AppendLogInput): Promise<SessionLog>;
  listLogs(sessionId: string, page: Page): Promise<SessionLog[]>;
}
