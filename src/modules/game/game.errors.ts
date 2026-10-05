import {
  ConflictError,
  NotFoundError,
} from '@shared/errors/http-errors.js';

export class GameNotFoundError extends NotFoundError {
  constructor() {
    super('Jogo não encontrado.');
  }
}

export class InviteCodeNotFoundError extends NotFoundError {
  constructor() {
    super('Código de convite inválido.');
  }
}

export class AlreadyMemberError extends ConflictError {
  constructor() {
    super('Você já participa deste jogo.');
  }
}

export class InviteCodeConflictError extends ConflictError {
  constructor() {
    super('Não foi possível gerar um código de convite único.');
  }
}
