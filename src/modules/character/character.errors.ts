import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@shared/errors/http-errors.js';
import { attributeDisplayName } from '@shared/rules/attributes.js';

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
    const attributeName = attributeDisplayName(attribute);
    super(`Valor de atributo inválido para ${attributeName}: ${value}.`);
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
      'Altura inválida: use um valor entre 150 e 250 cm, ou role para os extremos.',
    );
  }
}

export class InvalidWeightError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super(
      'Peso inválido: use um valor entre 50 e 150 kg, ou role para os extremos.',
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
    const attributeName = attributeDisplayName(attribute);
    super(
      `Orçamento de perícias de ${attributeName} excedido: ${requested} de ${pool} pontos.`,
    );
  }
}

export class NpReductionBlockedError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(overruns: readonly string[]) {
    super(`Não dá para descer: ${overruns.join(' ')}`);
  }
}

export class SkillBonusCapExceededError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(skillName: string, cap: number) {
    super(`Bônus de ${skillName} acima do limite de +${cap}.`);
  }
}

export class PreviewRateLimitedError extends DomainError {
  readonly code: DomainErrorCode = 'RATE_LIMITED';
  readonly httpStatus = 429;

  constructor() {
    super('Muitas simulações de personagem. Aguarde um instante.');
  }
}

export class SkillCatalogEmptyError extends Error {
  constructor() {
    super('Catálogo de perícias vazio.');
    this.name = new.target.name;
  }
}

export class CharacterVersionConflictError extends ConflictError {
  constructor() {
    super(
      'A ficha foi alterada por outra pessoa. Recarregue e tente novamente.',
    );
  }
}
