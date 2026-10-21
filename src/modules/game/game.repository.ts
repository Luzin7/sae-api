import type {
  CreateGameInput,
  Game,
  GamePlayer,
  Page,
  UpdateGameInput,
} from './game.entity.js';

export interface GameRepository {
  create(
    masterId: string,
    input: CreateGameInput & { inviteCode: string },
  ): Promise<Game>;
  findById(id: string): Promise<Game | null>;
  findByInviteCode(inviteCode: string): Promise<Game | null>;
  findMastered(masterId: string): Promise<Game[]>;
  findJoined(playerId: string, page: Page): Promise<Game[]>;
  update(id: string, input: UpdateGameInput): Promise<Game>;
  delete(id: string): Promise<void>;
  addPlayer(gameId: string, playerId: string): Promise<void>;
  removePlayer(gameId: string, playerId: string): Promise<void>;
  findPlayers(gameId: string): Promise<GamePlayer[]>;
  isMember(gameId: string, playerId: string): Promise<boolean>;
}
