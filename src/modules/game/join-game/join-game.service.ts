import type { Game } from '../game.entity.js';
import { AlreadyMemberError, InviteCodeNotFoundError } from '../game.errors.js';
import type { GameRepository } from '../game.repository.js';

export class JoinGameService {
  constructor(private readonly games: GameRepository) {}

  async execute(inviteCode: string, playerId: string): Promise<Game> {
    const game = await this.games.findByInviteCode(inviteCode);
    if (!game) throw new InviteCodeNotFoundError();

    const alreadyMember = await this.games.isMember(game.id, playerId);
    if (alreadyMember) throw new AlreadyMemberError();

    await this.games.addPlayer(game.id, playerId);

    return game;
  }
}
