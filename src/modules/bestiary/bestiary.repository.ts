import type {
  CreateMonsterInput,
  Monster,
  UpdateMonsterInput,
} from './bestiary.entity.js';

export interface MonsterRepository {
  create(input: CreateMonsterInput): Promise<Monster>;
  findById(id: string): Promise<Monster | null>;
  findByGame(gameId: string): Promise<Monster[]>;
  findReusableByOwner(ownerId: string): Promise<Monster[]>;
  save(id: string, patch: Partial<UpdateMonsterInput>): Promise<Monster>;
  delete(id: string): Promise<void>;
}
