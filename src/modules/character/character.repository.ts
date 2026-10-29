import type {
  Character,
  CharacterItem,
  CharacterSkill,
  CharacterSkillDetail,
  CreateCharacterInput,
  CreateCharacterResult,
  CreateItemInput,
  Page,
  SkillSummary,
  UpdateCharacterInput,
  UpdateSheetCommand,
  UpdateItemInput,
} from './character.entity.js';

export interface CharacterRepository {
  create(input: CreateCharacterInput): Promise<CreateCharacterResult>;
  findById(id: string): Promise<Character | null>;
  findByPlayer(playerId: string, page: Page): Promise<Character[]>;
  findByGame(gameId: string): Promise<Character[]>;
  save(id: string, patch: Partial<UpdateCharacterInput>): Promise<Character>;
  updateSheet(command: UpdateSheetCommand): Promise<Character>;
  delete(id: string): Promise<void>;
  findItems(characterId: string): Promise<CharacterItem[]>;
  findItemById(itemId: string): Promise<CharacterItem | null>;
  addItem(characterId: string, input: CreateItemInput): Promise<CharacterItem>;
  updateItem(itemId: string, input: UpdateItemInput): Promise<CharacterItem>;
  deleteItem(itemId: string): Promise<void>;
  findSkills(characterId: string): Promise<CharacterSkill[]>;
  findSkillDetails(characterId: string): Promise<CharacterSkillDetail[]>;
  findSkillById(skillId: string): Promise<SkillSummary | null>;
  findSkillsByIds(ids: readonly string[]): Promise<SkillSummary[]>;
  upsertSkill(
    characterId: string,
    skillId: string,
    proficiencyBonus: number,
  ): Promise<CharacterSkill>;
}
