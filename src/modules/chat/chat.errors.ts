import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';
import { ForbiddenError, NotFoundError } from '@shared/errors/http-errors.js';

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

export class MasterOnlyError extends ForbiddenError {
  constructor() {
    super('Apenas o mestre pode realizar esta ação.');
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
