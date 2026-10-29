import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import {
  createSeed,
  skillIdByName,
  type SeededTable,
} from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { characterSkill } from '@infra/db/schema.js';
import { characterRepository } from './character.repository.js';

const { cleanupSeed, seedCharacter, seedTable } = createSeed(
  'character-skill-spend',
);

describe.skipIf(!integrationEnabled)(
  'characterRepository.findSkillSpend (real DB)',
  () => {
    const characters = characterRepository();
    let table: SeededTable;

    beforeAll(async () => {
      table = await seedTable();
    });

    afterAll(async () => {
      await cleanupSeed();
    });

    it('groups the proficiency spent per character and attribute in one query', async () => {
      const first = await seedCharacter(table);
      const second = await seedCharacter(table);
      const untouched = await seedCharacter(table);
      await db.insert(characterSkill).values([
        {
          characterId: first.id,
          skillId: await skillIdByName('Erudição'),
          proficiencyBonus: 4,
        },
        {
          characterId: first.id,
          skillId: await skillIdByName('Lógica'),
          proficiencyBonus: 6,
        },
        {
          characterId: first.id,
          skillId: await skillIdByName('Carisma'),
          proficiencyBonus: 3,
        },
        {
          characterId: second.id,
          skillId: await skillIdByName('Erudição'),
          proficiencyBonus: 2,
        },
      ]);

      const rows = await characters.findSkillSpend([
        first.id,
        second.id,
        untouched.id,
      ]);

      expect(rows).toHaveLength(3);
      expect(rows).toEqual(
        expect.arrayContaining([
          { characterId: first.id, attribute: 'cognition', spent: 10 },
          { characterId: first.id, attribute: 'psyche', spent: 3 },
          { characterId: second.id, attribute: 'cognition', spent: 2 },
        ]),
      );
    });

    it('returns nothing for an empty list', async () => {
      await expect(characters.findSkillSpend([])).resolves.toEqual([]);
    });
  },
);
