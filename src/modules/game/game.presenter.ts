import type { Game, GamePlayer, GameSummary } from './game.entity.js';

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

export interface GameSummaryResponse {
  id: string;
  name: string;
}

export interface GamePlayerResponse {
  id: string;
  name: string;
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

  toSummary(summary: GameSummary): GameSummaryResponse {
    return { id: summary.id, name: summary.name };
  },

  toPlayer(player: GamePlayer): GamePlayerResponse {
    return { id: player.id, name: player.name };
  },
};
