import type { CreateGameInput, Game } from '../game.entity.js';
import type { GameRepository } from '../game.repository.js';

interface InviteCodeGenerator {
  generate(): string;
}

export class CreateGameService {
  constructor(
    private readonly games: GameRepository,
    private readonly inviteCodes: InviteCodeGenerator,
  ) {}

  async execute(masterId: string, input: CreateGameInput): Promise<Game> {
    const inviteCode = this.inviteCodes.generate();

    return this.games.create(masterId, { ...input, inviteCode });
  }
}
