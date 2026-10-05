export interface TokenPayload {
  sub: string;
  name: string;
  scope?: 'ws';
}

export interface WsTokenPayload {
  sub: string;
  scope: 'ws';
}

export interface Credentials {
  id: string;
  name: string;
  passwordHash: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
}

export interface AuthResult {
  player: PublicPlayer;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}
