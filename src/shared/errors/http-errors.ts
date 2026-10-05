import {
  DomainError,
  type DomainErrorCode,
} from './domain-error.js';

export class NotFoundError extends DomainError {
  readonly code: DomainErrorCode = 'NOT_FOUND';
  readonly httpStatus = 404;

  constructor(message = 'Recurso não encontrado.') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code: DomainErrorCode = 'FORBIDDEN';
  readonly httpStatus = 403;

  constructor(message = 'Acesso negado.') {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code: DomainErrorCode = 'CONFLICT';
  readonly httpStatus = 409;

  constructor(message = 'Conflito de estado.') {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code: DomainErrorCode = 'UNAUTHORIZED';
  readonly httpStatus = 401;

  constructor(message = 'Não autenticado.') {
    super(message);
  }
}
