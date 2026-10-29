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
    expect(body.skillCatalog.map((skill) => skill.name)).toContain(
      'Observação',
    );
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

  it('returns the starting wealth range of each social class', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/rules',
      headers: { authorization: `Bearer ${token()}` },
    });

    const body = response.json<{
      socialClasses: Array<{
        key: string;
        startingWealth: { min: number; max: number };
      }>;
    }>();
    expect(
      body.socialClasses.map(({ key, startingWealth }) => [
        key,
        startingWealth,
      ]),
    ).toEqual([
      ['opulento', { min: 1440, max: 5760 }],
      ['abastado', { min: 240, max: 960 }],
      ['plebeu', { min: 80, max: 320 }],
      ['miseravel', { min: 40, max: 160 }],
    ]);
  });

  it('serves the derivation tables with exact values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/rules',
      headers: { authorization: `Bearer ${token()}` },
    });

    const body = response.json();
    expect(body.bodyDimensions.height).toEqual({
      unit: 'cm',
      exact: { min: 150, max: 250 },
      below: { min: 140, max: 149 },
      above: { min: 251, max: 270 },
    });
    expect(body.bodyDimensions.weight).toEqual({
      unit: 'kg',
      exact: { min: 50, max: 150 },
      below: { min: 40, max: 49 },
      above: { min: 151, max: 170 },
    });
    expect(body.hitDieByConstitution).toEqual({
      '-5': { die: 'd6', max: 6 },
      '-4': { die: 'd6', max: 6 },
      '-3': { die: 'd8', max: 8 },
      '-2': { die: 'd8', max: 8 },
      '1': { die: 'd10', max: 10 },
      '2': { die: 'd10', max: 10 },
      '3': { die: 'd12', max: 12 },
      '4': { die: 'd12', max: 12 },
      '5': { die: 'd20', max: 20 },
    });
    expect(body.attributeDice).toEqual({
      '-5': { dice: 5, keep: 'worst' },
      '-4': { dice: 4, keep: 'worst' },
      '-3': { dice: 3, keep: 'worst' },
      '-2': { dice: 2, keep: 'worst' },
      '1': { dice: 1, keep: 'best' },
      '2': { dice: 2, keep: 'best' },
      '3': { dice: 3, keep: 'best' },
      '4': { dice: 4, keep: 'best' },
      '5': { dice: 5, keep: 'best' },
    });
    const pools = body.proficiencyPoolByNp;
    expect([1, 20].map((np) => pools.imperito[np])).toEqual([2, 20]);
    expect([1, 20].map((np) => pools.competente[np])).toEqual([6, 60]);
    expect([1, 20].map((np) => pools.versado[np])).toEqual([10, 100]);
    expect([1, 20].map((np) => pools.especialista[np])).toEqual([14, 140]);
    expect(pools.especialista[3]).toBe(28);
    expect(body.skillCapByLevel).toEqual({
      imperito: 20,
      competente: 20,
      versado: 20,
      especialista: 30,
    });
    expect(body.bExpByNp).toHaveLength(21);
    expect([1, 2, 20].map((np) => body.bExpByNp[np])).toEqual([0, 1, 10]);
    expect(body.vitalFormulas).toEqual({
      maxHp: { base: 20, skill: 'Vitalidade' },
      maxEffort: { base: 20, skill: 'Condicionamento' },
    });
  });
});
