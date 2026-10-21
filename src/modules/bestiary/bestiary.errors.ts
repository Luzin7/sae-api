import { ForbiddenError, NotFoundError } from '@shared/errors/http-errors.js';

export class MonsterNotFoundError extends NotFoundError {
  constructor() {
    super('Monstro não encontrado.');
  }
}

export class BestiaryForbiddenError extends ForbiddenError {
  constructor() {
    super('Apenas o mestre pode gerenciar monstros.');
  }
}
