export interface Player {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePlayerInput {
  name: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: Date;
}
