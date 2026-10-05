import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';
import { NotFoundError } from '@shared/errors/http-errors.js';

export class CharacterNotFoundError extends NotFoundError {
  constructor() {
    super('Personagem não encontrado.');
  }
}

export class CharacterItemNotFoundError extends NotFoundError {
  constructor() {
    super('Item não encontrado.');
  }
}

export class SkillNotFoundError extends NotFoundError {
  constructor() {
    super('Perícia não encontrada.');
  }
}

export class AttributeBudgetExceededError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('Orçamento de atributos excedido para o NP informado.');
  }
}

export class InvalidAttributeError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(attribute: string, value: number) {
    super(`Valor de atributo inválido para ${attribute}: ${value}.`);
  }
}

export class InvalidArchetypeError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(personality: string, posture: string) {
    super(
      `Arquétipo inválido: personalidade "${personality}" / postura "${posture}".`,
    );
  }
}

export class SkillPoolExceededError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(attribute: string, pool: number, requested: number) {
    super(
      `Orçamento de perícias de ${attribute} excedido: ${requested} de ${pool} pontos.`,
    );
  }
}
