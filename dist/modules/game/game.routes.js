import { authenticate } from '../../middleware/authenticate.js';
import { GameService } from './game.service.js';
import { CreateGameBodySchema, JoinGameBodySchema, UpdateGameBodySchema } from './game.schemas.js';
import { generateInviteCode } from '../../lib/invite-code.js';
import { db } from '../../db/index.js';
import { game, playerGame } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
function buildGameService() {
    return new GameService({
        create: async (data) => {
            const [created] = await db.insert(game).values(data).returning();
            return created;
        },
        findById: async (id) => (await db.query.game.findFirst({ where: eq(game.id, id) })) ?? null,
        findByInviteCode: async (code) => (await db.query.game.findFirst({ where: eq(game.inviteCode, code) })) ?? null,
        findByMasterId: (masterId) => db.select().from(game).where(eq(game.masterId, masterId)),
        findByPlayerId: async (playerId, { limit, offset }) => {
            const rows = await db
                .select({ id: game.id, name: game.name })
                .from(game)
                .innerJoin(playerGame, eq(playerGame.gameId, game.id))
                .where(eq(playerGame.playerId, playerId))
                .limit(limit)
                .offset(offset);
            return rows;
        },
        update: async (id, data) => {
            const [updated] = await db.update(game).set(data).where(eq(game.id, id)).returning();
            return updated;
        },
        delete: async (id) => {
            await db.delete(game).where(eq(game.id, id));
        },
        addPlayer: async (gameId, playerId) => {
            await db.insert(playerGame).values({ gameId, playerId });
        },
        removePlayer: async (gameId, playerId) => {
            await db
                .delete(playerGame)
                .where(and(eq(playerGame.gameId, gameId), eq(playerGame.playerId, playerId)));
        },
        getPlayers: async (gameId) => {
            const rows = await db.query.playerGame.findMany({
                where: eq(playerGame.gameId, gameId),
                with: { player: true },
            });
            return rows.map((r) => r.player);
        },
        isPlayerInGame: async (gameId, playerId) => {
            const row = await db.query.playerGame.findFirst({
                where: and(eq(playerGame.gameId, gameId), eq(playerGame.playerId, playerId)),
            });
            return row !== undefined;
        },
    }, { generate: generateInviteCode });
}
export default async function gameRoutes(app) {
    app.post('/', { preHandler: authenticate }, async (request, reply) => {
        const body = CreateGameBodySchema.parse(request.body);
        const service = buildGameService();
        const game = await service.create(body, request.playerId);
        return reply.status(201).send({ game });
    });
    app.get('/mine', { preHandler: authenticate }, async (request) => {
        const { limit = '20', offset = '0' } = request.query;
        const service = buildGameService();
        const games = await service.getMine(request.playerId, {
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        return { games };
    });
    app.get('/mastered', { preHandler: authenticate }, async (request) => {
        const service = buildGameService();
        const games = await service.getMastered(request.playerId);
        return { games };
    });
    app.post('/join', { preHandler: authenticate }, async (request) => {
        const { inviteCode } = JoinGameBodySchema.parse(request.body);
        const service = buildGameService();
        const game = await service.join(inviteCode, request.playerId);
        return { game };
    });
    app.get('/:id', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const service = buildGameService();
        const game = await service.getById(id, request.playerId);
        return { game };
    });
    app.patch('/:id', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const body = UpdateGameBodySchema.parse(request.body);
        const service = buildGameService();
        const game = await service.update(id, body, request.playerId);
        return { game };
    });
    app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
        const { id } = request.params;
        const service = buildGameService();
        await service.delete(id, request.playerId);
        return reply.status(204).send();
    });
    app.get('/:id/players', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const service = buildGameService();
        return service.getPlayers(id, request.playerId);
    });
    app.delete('/:id/leave', { preHandler: authenticate }, async (request, reply) => {
        const { id } = request.params;
        const service = buildGameService();
        await service.leave(id, request.playerId);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=game.routes.js.map