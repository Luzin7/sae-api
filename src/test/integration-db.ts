import { randomUUID } from 'node:crypto';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '@infra/db/index.js';
import {
  character,
  game,
  monster,
  player,
  playerGame,
  session,
  skill,
} from '@infra/db/schema.js';

export interface SeededTable {
  master: { id: string };
  member: { id: string };
  gameId: string;
  sessionId: string;
}

export async function skillIdByName(name: string): Promise<string> {
  const [row] = await db
    .select({ id: skill.id })
    .from(skill)
    .where(eq(skill.name, name));
  if (!row) throw new Error(`skill ${name} missing`);

  return row.id;
}

export function createSeed(scope: string) {
  const prefix = `verify-${scope}-`;

  function seedName(label: string): string {
    return `${prefix}${label}-${randomUUID()}`;
  }

  async function seedPlayer(label: string): Promise<{ id: string }> {
    const [row] = await db
      .insert(player)
      .values({ name: seedName(label), passwordHash: 'x' })
      .returning({ id: player.id });
    if (!row) throw new Error('seed player failed');

    return row;
  }

  async function seedTable(): Promise<SeededTable> {
    const master = await seedPlayer('master');
    const member = await seedPlayer('member');
    const [gameRow] = await db
      .insert(game)
      .values({
        masterId: master.id,
        name: seedName('game'),
        inviteCode: randomUUID().slice(0, 20),
      })
      .returning({ id: game.id });
    if (!gameRow) throw new Error('seed game failed');
    await db
      .insert(playerGame)
      .values({ playerId: member.id, gameId: gameRow.id });
    const [sessionRow] = await db
      .insert(session)
      .values({ gameId: gameRow.id })
      .returning({ id: session.id });
    if (!sessionRow) throw new Error('seed session failed');

    return {
      master,
      member,
      gameId: gameRow.id,
      sessionId: sessionRow.id,
    };
  }

  async function seedCharacter(
    table: SeededTable,
    overrides: Partial<typeof character.$inferInsert> = {},
  ): Promise<typeof character.$inferSelect> {
    const [row] = await db
      .insert(character)
      .values({
        playerId: table.member.id,
        gameId: table.gameId,
        nickname: seedName('char'),
        maxHp: 26,
        currentHp: 26,
        maxEffort: 20,
        ...overrides,
      })
      .returning();
    if (!row) throw new Error('seed character failed');

    return row;
  }

  async function cleanupSeed(): Promise<void> {
    const players = await db
      .select({ id: player.id })
      .from(player)
      .where(like(player.name, `${prefix}%`));
    const ids = players.map((row) => row.id);
    if (ids.length === 0) return;

    await db.delete(monster).where(inArray(monster.createdBy, ids));
    await db.delete(game).where(inArray(game.masterId, ids));
    await db.delete(player).where(inArray(player.id, ids));
  }

  async function seedInactiveSession(gameId: string): Promise<string> {
    const [row] = await db
      .insert(session)
      .values({ gameId, isActive: false })
      .returning({ id: session.id });
    if (!row) throw new Error('seed session failed');

    return row.id;
  }

  async function seedMonster(
    createdBy: string,
    overrides: Partial<typeof monster.$inferInsert> = {},
  ): Promise<typeof monster.$inferSelect> {
    const [row] = await db
      .insert(monster)
      .values({
        createdBy,
        name: seedName('monster'),
        np: 1,
        maxHp: 10,
        currentHp: 10,
        maxEffort: 5,
        currentEffort: 5,
        ...overrides,
      })
      .returning();
    if (!row) throw new Error('seed monster failed');

    return row;
  }

  return {
    seedPlayer,
    seedTable,
    seedCharacter,
    cleanupSeed,
    seedInactiveSession,
    seedMonster,
  };
}
