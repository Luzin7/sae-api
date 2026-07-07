import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { calcBExp, calcMaxEffort, calcMaxHp } from './character.stats.js';
import type {
  CreateCharacterBody,
  CreateItemBody,
  UpdateCharacterBody,
  UpdateItemBody,
} from './character.schemas.js';

interface CharacterData {
  id: string;
  playerId: string;
  nickname: string;
  maxHp?: number;
  maxEffort?: number;
  bExp?: number;
  level?: number;
  constitution?: number;
  profConstitution?: number;
  [key: string]: unknown;
}

interface CharacterRepo {
  create(data: Record<string, unknown>): Promise<CharacterData>;
  findById(id: string): Promise<CharacterData | null>;
  findByPlayerId(playerId: string, pagination: { limit: number; offset: number }): Promise<CharacterData[]>;
  findByGameId(gameId: string): Promise<CharacterData[]>;
  update(id: string, data: Record<string, unknown>): Promise<CharacterData>;
  delete(id: string): Promise<void>;
  createItem(characterId: string, data: CreateItemBody): Promise<unknown>;
  updateItem(itemId: string, data: UpdateItemBody): Promise<unknown>;
  deleteItem(itemId: string): Promise<void>;
  findItems(characterId: string): Promise<unknown[]>;
  findSkills(characterId: string): Promise<unknown[]>;
  upsertSkill(characterId: string, skill: string, points: number): Promise<unknown>;
}

interface GameRepo {
  isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
}

export class CharacterService {
  constructor(
    private readonly repo: CharacterRepo,
    private readonly gameRepo: GameRepo,
  ) {}

  async create(body: CreateCharacterBody & Record<string, unknown>, playerId: string) {
    const inGame = await this.gameRepo.isPlayerInGame(body.gameId, playerId);
    if (!inGame) throw new ForbiddenError();

    const level = body.level ?? 1;
    const con = body.constitution ?? 0;
    const profVitality = body.profConstitution ?? 0;
    const profWillpower = body.profConstitution ?? 0;

    const maxHp = calcMaxHp(level, con, profVitality);
    const maxEffort = calcMaxEffort(con, profWillpower);
    const bExp = calcBExp(level);

    return this.repo.create({
      ...body,
      playerId,
      maxHp,
      currentHp: maxHp,
      maxEffort,
      currentEffort: maxEffort,
      bExp,
    });
  }

  async getById(id: string, requesterId: string) {
    const character = await this.repo.findById(id);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();
    return character;
  }

  async getMine(playerId: string, pagination: { limit: number; offset: number } = { limit: 20, offset: 0 }) {
    return this.repo.findByPlayerId(playerId, pagination);
  }

  async getByGame(gameId: string) {
    return this.repo.findByGameId(gameId);
  }

  async update(id: string, body: UpdateCharacterBody, requesterId: string) {
    const character = await this.repo.findById(id);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    const updates: Record<string, unknown> = { ...body };

    const level = (body.level ?? character.level ?? 1) as number;
    const con = (body.constitution ?? character.constitution ?? 0) as number;
    const profVitality = (body.profConstitution ?? character.profConstitution ?? 0) as number;

    updates.maxHp = calcMaxHp(level, con, profVitality);
    updates.maxEffort = calcMaxEffort(con, profVitality);
    updates.bExp = calcBExp(level);

    return this.repo.update(id, updates);
  }

  async delete(id: string, requesterId: string) {
    const character = await this.repo.findById(id);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    await this.repo.delete(id);
  }

  async createItem(characterId: string, body: CreateItemBody, requesterId: string) {
    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    return this.repo.createItem(characterId, body);
  }

  async updateItem(characterId: string, itemId: string, body: UpdateItemBody, requesterId: string) {
    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    return this.repo.updateItem(itemId, body);
  }

  async deleteItem(characterId: string, itemId: string, requesterId: string) {
    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    await this.repo.deleteItem(itemId);
  }

  async getItems(characterId: string, requesterId: string) {
    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    return this.repo.findItems(characterId);
  }

  async getSkills(characterId: string, requesterId: string) {    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    return this.repo.findSkills(characterId);
  }

  async upsertSkill(characterId: string, requesterId: string, skill: string, points: number) {
    const character = await this.repo.findById(characterId);
    if (!character) throw new NotFoundError('Character');
    if (character.playerId !== requesterId) throw new ForbiddenError();

    return this.repo.upsertSkill(characterId, skill, points);
  }
}
