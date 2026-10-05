import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attributeBudget } from '@shared/rules/attributes.js';
import { SKILLS } from '@shared/rules/skills.js';
import type {
  SkillCatalog,
  SkillCatalogEntry,
} from './skill-catalog.contract.js';
import rulesRoutes from './rules.routes.js';

const skillCatalog: SkillCatalog = {
  async list(): Promise<SkillCatalogEntry[]> {
    return SKILLS.map((skill, index) => ({
      id: `skill-${index + 1}`,
      name: skill.name,
      attribute: skill.attribute,
    }));
  },
};

const app = Fastify();

beforeAll(async () => {
  await app.register(jwt, { secret: 'test-secret' });
  await app.register(rulesRoutes, { skillCatalog });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return app.jwt.sign({ sub: 'player-1', name: 'Tester' });
}

describe('GET /rules', () => {
  it('returns 401 without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/rules' });
    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with the skill catalog of 30 skills carrying ids', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/rules',
      headers: { authorization: `Bearer ${token()}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      skillCatalog: Array<{ id: string; name: string; attribute: string }>;
    }>();
    expect(body.skillCatalog).toHaveLength(30);
    expect(body.skillCatalog.map((skill) => skill.name)).toContain('Erudição');
    expect(body.skillCatalog.map((skill) => skill.name)).toContain('Observação');
    expect(body.skillCatalog.every((skill) => skill.id.length > 0)).toBe(true);
  });

  it('returns the attribute budget indexed by NP', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/rules',
      headers: { authorization: `Bearer ${token()}` },
    });

    const body = response.json<{ attributeBudgetByNp: number[] }>();
    expect(body.attributeBudgetByNp[0]).toBe(0);
    expect(body.attributeBudgetByNp[1]).toBe(attributeBudget(1));
    expect(body.attributeBudgetByNp[1]).toBe(20);
    expect(body.attributeBudgetByNp[20]).toBe(attributeBudget(20));
    expect(body.attributeBudgetByNp).toHaveLength(21);
  });
});
