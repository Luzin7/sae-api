import {
  DomainError,
  type DomainErrorCode,
} from '@shared/errors/domain-error.js';

export class InvalidCredentialsError extends DomainError {
  readonly code: DomainErrorCode = 'UNAUTHORIZED';
  readonly httpStatus = 401;

  constructor() {
    super('Nome de usuário ou senha inválidos.');
  }
}

export class UsernameTakenError extends DomainError {
  readonly code: DomainErrorCode = 'CONFLICT';
  readonly httpStatus = 409;

  constructor() {
    super('Este nome de usuário já está em uso.');
  }
}

export class SessionExpiredError extends DomainError {
  readonly code: DomainErrorCode = 'UNAUTHORIZED';
  readonly httpStatus = 401;

  constructor() {
    super('Sessão expirada ou inválida.');
  }
}

export class LoginRateLimitedError extends DomainError {
  readonly code: DomainErrorCode = 'RATE_LIMITED';
  readonly httpStatus = 429;

  constructor() {
    super(
      'Muitas tentativas de login para esta conta. Aguarde alguns minutos.',
    );
  }
}

export class SessionRevokedError extends DomainError {
  readonly code: DomainErrorCode = 'UNAUTHORIZED';
  readonly httpStatus = 401;

  constructor() {
    super('Sessão encerrada. Entre novamente.');
  }
}

export class RefreshTokenReusedError extends DomainError {
  readonly code: DomainErrorCode = 'UNAUTHORIZED';
  readonly httpStatus = 401;

  constructor() {
    super('Sessão encerrada por segurança. Entre novamente.');
  }
}
