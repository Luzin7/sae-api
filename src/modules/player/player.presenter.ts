import type { Player, PlayerProfile } from './player.entity.js';

export interface PlayerResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProfileResponse {
  id: string;
  name: string;
  createdAt: string;
}

export const PlayerPresenter = {
  toHTTP(player: Player): PlayerResponse {
    return {
      id: player.id,
      name: player.name,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
    };
  },

  toProfile(profile: PlayerProfile): PlayerProfileResponse {
    return {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt.toISOString(),
    };
  },
};
