import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import type { GetMeService } from './get-me/get-me.service.js';
import type { GetPlayerService } from './get-player/get-player.service.js';
import { PlayerPresenter } from './player.presenter.js';
import { UpdatePlayerBodySchema } from './player.schemas.js';
import type { UpdateMeService } from './update-me/update-me.service.js';

export interface PlayerServices {
  getMe: GetMeService;
  getPlayer: GetPlayerService;
  updateMe: UpdateMeService;
}

export interface PlayerRoutesOptions {
  services: PlayerServices;
}

export default async function playerRoutes(
  app: FastifyInstance,
  opts: PlayerRoutesOptions,
) {
  app.get('/me', { preHandler: authenticate }, async (request) => {
    const player = await opts.services.getMe.execute(request.playerId);
    return { player: PlayerPresenter.toHTTP(player) };
  });

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authenticate },
    async (request) => {
      const profile = await opts.services.getPlayer.execute(request.params.id);
      return { player: PlayerPresenter.toProfile(profile) };
    },
  );

  app.patch('/me', { preHandler: authenticate }, async (request) => {
    const body = UpdatePlayerBodySchema.parse(request.body);
    const player = await opts.services.updateMe.execute(request.playerId, body);
    return { player: PlayerPresenter.toHTTP(player) };
  });
}
