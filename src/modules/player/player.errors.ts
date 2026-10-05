import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';

export class PlayerNotFoundError extends DomainError {
  readonly code: DomainErrorCode = 'NOT_FOUND';
  readonly httpStatus = 404;

  constructor() {
    super('Jogador não encontrado.');
  }
}

export class PlayerNameTakenError extends DomainError {
  readonly code: DomainErrorCode = 'CONFLICT';
  readonly httpStatus = 409;

  constructor() {
    super('Este nome de jogador já está em uso.');
  }
}
