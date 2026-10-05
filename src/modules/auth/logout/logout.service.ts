import type { AuthSessionRepository } from '../auth.repository.js';

export class LogoutService {
  constructor(private readonly sessions: AuthSessionRepository) {}

  async execute(playerId: string): Promise<void> {
    await this.sessions.deleteByPlayerId(playerId);
  }
}
