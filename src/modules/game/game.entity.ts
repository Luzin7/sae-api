export interface Game {
  id: string;
  masterId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  inviteCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameSummary {
  id: string;
  name: string;
}

export interface GamePlayer {
  id: string;
  name: string;
}

export interface CreateGameInput {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface UpdateGameInput {
  name?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface Page {
  limit: number;
  offset: number;
}

export const DEFAULT_GAME_PAGE: Page = { limit: 20, offset: 0 };
