import { authenticate } from '../../middleware/authenticate.js';
import { CharacterService } from './character.service.js';
import { CreateCharacterBodySchema, CreateItemBodySchema, UpdateCharacterBodySchema, UpdateEffortBodySchema, UpdateHpBodySchema, UpdateItemBodySchema, UpsertSkillBodySchema, } from './character.schemas.js';
import { db } from '../../db/index.js';
import { character, characterItem, characterSkill, playerGame } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
function buildCharacterService() {
    return new CharacterService({
        create: async (data) => {
            const [created] = await db
                .insert(character)
                .values(data)
                .returning();
            return created;
        },
        findById: async (id) => (await db.query.character.findFirst({ where: eq(character.id, id) })) ?? null,
        findByPlayerId: (playerId, { limit, offset }) => db.select().from(character).where(eq(character.playerId, playerId)).limit(limit).offset(offset),
        findByGameId: (gameId) => db.select().from(character).where(eq(character.gameId, gameId)),
        update: async (id, data) => {
            const [updated] = await db
                .update(character)
                .set(data)
                .where(eq(character.id, id))
                .returning();
            return updated;
        },
        delete: async (id) => {
            await db.delete(character).where(eq(character.id, id));
        },
        createItem: async (characterId, data) => {
            const [created] = await db
                .insert(characterItem)
                .values({ characterId, ...data })
                .returning();
            return created;
        },
        updateItem: async (itemId, data) => {
            const [updated] = await db
                .update(characterItem)
                .set(data)
                .where(eq(characterItem.id, itemId))
                .returning();
            return updated;
        },
        deleteItem: async (itemId) => {
            await db.delete(characterItem).where(eq(characterItem.id, itemId));
        },
        findItems: async (characterId) => db.select().from(characterItem).where(eq(characterItem.characterId, characterId)),
        findSkills: async (characterId) => db.select().from(characterSkill).where(eq(characterSkill.characterId, characterId)),
        upsertSkill: async (characterId, skill, points) => {
            const [result] = await db
                .insert(characterSkill)
                .values({ characterId, skill: skill, points })
                .onConflictDoUpdate({
                target: [characterSkill.characterId, characterSkill.skill],
                set: { points },
            })
                .returning();
            return result;
        },
    }, {
        isPlayerInGame: async (gameId, playerId) => {
            const row = await db.query.playerGame.findFirst({
                where: and(eq(playerGame.gameId, gameId), eq(playerGame.playerId, playerId)),
            });
            return row !== undefined;
        },
    });
}
export default async function characterRoutes(app) {
    app.post('/', { preHandler: authenticate }, async (request, reply) => {
        const body = CreateCharacterBodySchema.parse(request.body);
        const service = buildCharacterService();
        const character = await service.create(body, request.playerId);
        return reply.status(201).send({ character });
    });
    app.get('/mine', { preHandler: authenticate }, async (request) => {
        const { limit = '20', offset = '0' } = request.query;
        const service = buildCharacterService();
        const characters = await service.getMine(request.playerId, {
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        return { characters };
    });
    app.get('/game/:gameId', { preHandler: authenticate }, async (request) => {
        const { gameId } = request.params;
        const service = buildCharacterService();
        const characters = await service.getByGame(gameId);
        return { characters };
    });
    app.get('/:id', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const service = buildCharacterService();
        const character = await service.getById(id, request.playerId);
        return { character };
    });
    app.patch('/:id', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const body = UpdateCharacterBodySchema.parse(request.body);
        const service = buildCharacterService();
        const character = await service.update(id, body, request.playerId);
        return { character };
    });
    app.patch('/:id/hp', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const { currentHp } = UpdateHpBodySchema.parse(request.body);
        const service = buildCharacterService();
        const character = await service.update(id, { currentHp }, request.playerId);
        return { character };
    });
    app.patch('/:id/pe', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const { currentEffort } = UpdateEffortBodySchema.parse(request.body);
        const service = buildCharacterService();
        const character = await service.update(id, { currentEffort }, request.playerId);
        return { character };
    });
    app.get('/:id/items', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const service = buildCharacterService();
        const items = await service.getItems(id, request.playerId);
        return { items };
    });
    app.post('/:id/items', { preHandler: authenticate }, async (request, reply) => {
        const { id } = request.params;
        const body = CreateItemBodySchema.parse(request.body);
        const service = buildCharacterService();
        const item = await service.createItem(id, body, request.playerId);
        return reply.status(201).send({ item });
    });
    app.patch('/:id/items/:itemId', { preHandler: authenticate }, async (request) => {
        const { id, itemId } = request.params;
        const body = UpdateItemBodySchema.parse(request.body);
        const service = buildCharacterService();
        const item = await service.updateItem(id, itemId, body, request.playerId);
        return { item };
    });
    app.delete('/:id/items/:itemId', { preHandler: authenticate }, async (request, reply) => {
        const { id, itemId } = request.params;
        const service = buildCharacterService();
        await service.deleteItem(id, itemId, request.playerId);
        return reply.status(204).send();
    });
    app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
        const { id } = request.params;
        const service = buildCharacterService();
        await service.delete(id, request.playerId);
        return reply.status(204).send();
    });
    app.get('/:id/skills', { preHandler: authenticate }, async (request) => {
        const { id } = request.params;
        const service = buildCharacterService();
        const skills = await service.getSkills(id, request.playerId);
        return { skills };
    });
    app.post('/:id/skills', { preHandler: authenticate }, async (request, reply) => {
        const { id } = request.params;
        const { skill: skillName, points } = UpsertSkillBodySchema.parse(request.body);
        const service = buildCharacterService();
        const skill = await service.upsertSkill(id, request.playerId, skillName, points);
        return reply.status(200).send({ skill });
    });
}
//# sourceMappingURL=character.routes.js.map