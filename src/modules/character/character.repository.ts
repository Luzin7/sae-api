import type {
  Character,
  CharacterItem,
  CharacterSkill,
  CharacterSkillDetail,
  CreateCharacterInput,
  CreateCharacterResult,
  CreateItemInput,
  VitalsChangeOutcome,
  Page,
  SkillSpendRow,
  SkillSummary,
  UpdateCharacterInput,
  UpdateSheetCommand,
  UpdateItemInput,
  UpsertSkillCommand,
} from './character.entity.js';

export interface CharacterRepository {
  create(input: CreateCharacterInput): Promise<CreateCharacterResult>;
  findById(id: string): Promise<Character | null>;
  findByPlayer(playerId: string, page: Page): Promise<Character[]>;
  findByGame(gameId: string): Promise<Character[]>;
  save(id: string, patch: Partial<UpdateCharacterInput>): Promise<Character>;
  updateSheet(command: UpdateSheetCommand): Promise<Character>;
  /** Applies the PE rule to the locked row; see `changeLockedCharacterEffort`. */
  changeEffort(id: string, delta: number): Promise<VitalsChangeOutcome>;
  /** Applies the PS delta to the locked row; see `changeLockedCharacterHp`. */
  changeHp(id: string, delta: number): Promise<VitalsChangeOutcome>;
  delete(id: string): Promise<void>;
  findItems(characterId: string): Promise<CharacterItem[]>;
  findItemById(itemId: string): Promise<CharacterItem | null>;
  addItem(characterId: string, input: CreateItemInput): Promise<CharacterItem>;
  updateItem(itemId: string, input: UpdateItemInput): Promise<CharacterItem>;
  deleteItem(itemId: string): Promise<void>;
  findSkills(characterId: string): Promise<CharacterSkill[]>;
  findSkillDetails(characterId: string): Promise<CharacterSkillDetail[]>;
  /** One grouped query: proficiency points spent per character and attribute. */
  findSkillSpend(characterIds: readonly string[]): Promise<SkillSpendRow[]>;
  findSkillById(skillId: string): Promise<SkillSummary | null>;
  findSkillsByIds(ids: readonly string[]): Promise<SkillSummary[]>;
  /**
   * Upserts the skill and, in the same transaction, applies the limits the
   * command derives, clamping current HP and PE to them.
   */
  upsertSkill(command: UpsertSkillCommand): Promise<CharacterSkill>;
}
