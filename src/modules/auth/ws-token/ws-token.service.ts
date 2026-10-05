import type { WsTokenPayload } from '../auth.entity.js';

const WS_TOKEN_TTL = '60s';

export class WsTokenService {
  constructor(
    private readonly signing: {
      sign(payload: WsTokenPayload, options: { expiresIn: string }): string;
    },
  ) {}

  execute(playerId: string): string {
    return this.signing.sign(
      { sub: playerId, scope: 'ws' },
      { expiresIn: WS_TOKEN_TTL },
    );
  }
}
