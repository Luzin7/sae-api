import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';
import { ForbiddenError, NotFoundError } from '@shared/errors/http-errors.js';

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

export class InvalidHeightError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super(
      'Altura inválida: use um valor entre 150 e 250 cm, ou informe heightRoll para os extremos.',
    );
  }
}

export class InvalidWeightError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super(
      'Peso inválido: use um valor entre 50 e 150 kg, ou informe weightRoll para os extremos.',
    );
  }
}

export class NpMasterOnlyError extends ForbiddenError {
  constructor() {
    super('Apenas o mestre pode alterar o NP.');
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
