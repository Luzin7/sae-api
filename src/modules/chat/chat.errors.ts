import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@shared/errors/http-errors.js';

export class ChatSessionNotFoundError extends NotFoundError {
  constructor() {
    super('Sessão não encontrada.');
  }
}

export class ChatForbiddenError extends ForbiddenError {
  constructor() {
    super('Você não participa desta sessão.');
  }
}

export class ChatCharacterNotFoundError extends NotFoundError {
  constructor() {
    super('Personagem não encontrado nesta sessão.');
  }
}

export class ChatSkillNotFoundError extends NotFoundError {
  constructor() {
    super('Perícia não encontrada.');
  }
}

export class CombatStateNotFoundError extends NotFoundError {
  constructor() {
    super('Combate não encontrado nesta sessão.');
  }
}

export class CombatantNotFoundError extends NotFoundError {
  constructor() {
    super('Combatente não encontrado nesta sessão.');
  }
}

export class ChatMonsterNotFoundError extends NotFoundError {
  constructor() {
    super('Monstro não encontrado nesta sessão.');
  }
}

export class CombatNotReadyError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('A ordem de iniciativa só pode avançar quando todos rolaram.');
  }
}

export class TestTargetNotFoundError extends NotFoundError {
  constructor() {
    super('Personagem alvo do teste não encontrado.');
  }
}

export class ChatTestNotFoundError extends NotFoundError {
  constructor() {
    super('Teste não encontrado.');
  }
}

export class MasterOnlyError extends ForbiddenError {
  constructor() {
    super('Apenas o mestre pode realizar esta ação.');
  }
}

export class ChatTestNotTargetedError extends ForbiddenError {
  constructor() {
    super('Este teste não é para seu personagem.');
  }
}

export class ChatNoActiveRollError extends ForbiddenError {
  constructor() {
    super('Nenhum teste ou turno ativo para rolar.');
  }
}

export class ChatNotYourTurnError extends ForbiddenError {
  constructor() {
    super('Não é seu turno.');
  }
}

export class InvalidDifficultyGradeError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('Grau de dificuldade inválido.');
  }
}

export class ChatTestClosedError extends ConflictError {
  constructor() {
    super('Este teste já foi encerrado.');
  }
}

export class ChatAlreadyRolledError extends ConflictError {
  constructor() {
    super('Você já rolou este teste.');
  }
}

export class EmptyChatMessageError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('A mensagem não pode ser vazia.');
  }
}

export class InvalidHpError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('HP inválido para este personagem.');
  }
}

export class EmptyNarrationError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor() {
    super('A narração não pode ser vazia.');
  }
}
