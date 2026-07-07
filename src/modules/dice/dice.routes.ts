import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { DiceService } from './dice.service.js';
import { DiceRollBodySchema } from './dice.schemas.js';

export default async function diceRoutes(app: FastifyInstance) {
  app.post('/roll', { preHandler: authenticate }, async (request) => {
    const body = DiceRollBodySchema.parse(request.body);
    const service = new DiceService();
    return service.roll(body);
  });
}
