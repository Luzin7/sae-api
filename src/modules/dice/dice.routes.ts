import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import { RollInputSchema } from './dice.schemas.js';
import type { RollService } from './roll/roll.service.js';

export interface DiceServices {
  roll: RollService;
}

export interface DiceRoutesOptions {
  services: DiceServices;
}

export default async function diceRoutes(
  app: FastifyInstance,
  opts: DiceRoutesOptions,
) {
  app.post('/roll', { preHandler: authenticate }, async (request) => {
    const input = RollInputSchema.parse(request.body);

    return opts.services.roll.execute(input);
  });
}
