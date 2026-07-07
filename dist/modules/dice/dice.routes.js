import { authenticate } from '../../middleware/authenticate.js';
import { DiceService } from './dice.service.js';
import { DiceRollBodySchema } from './dice.schemas.js';
export default async function diceRoutes(app) {
    app.post('/roll', { preHandler: authenticate }, async (request) => {
        const body = DiceRollBodySchema.parse(request.body);
        const service = new DiceService();
        return service.roll(body);
    });
}
//# sourceMappingURL=dice.routes.js.map