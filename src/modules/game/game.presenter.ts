import type {
  Game,
  GamePlayer,
  GamePlayerPresence,
  GameRoster,
} from './game.entity.js';

export interface GameResponse {
  id: string;
  masterId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  inviteCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GamePlayerResponse {
  id: string;
  name: string;
}

export interface GamePlayerPresenceResponse extends GamePlayerResponse {
  characterIds: string[];
}

export interface GameRosterResponse {
  master: GamePlayerResponse | null;
  players: GamePlayerPresenceResponse[];
}

export const GamePresenter = {
  toHTTP(game: Game): GameResponse {
    return {
      id: game.id,
      masterId: game.masterId,
      name: game.name,
      description: game.description,
      imageUrl: game.imageUrl,
      inviteCode: game.inviteCode,
      isActive: game.isActive,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
    };
  },

  toPlayer(player: GamePlayer): GamePlayerResponse {
    return { id: player.id, name: player.name };
  },

  toPlayerPresence(player: GamePlayerPresence): GamePlayerPresenceResponse {
    return {
      id: player.id,
      name: player.name,
      characterIds: player.characterIds,
    };
  },

  toRoster(roster: GameRoster): GameRosterResponse {
    return {
      master: roster.master ? GamePresenter.toPlayer(roster.master) : null,
      players: roster.players.map(GamePresenter.toPlayerPresence),
    };
  },
};
