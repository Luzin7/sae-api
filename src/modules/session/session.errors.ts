import { NotFoundError } from '@shared/errors/http-errors.js';

export class SessionNotFoundError extends NotFoundError {
  constructor() {
    super('Sessão não encontrada.');
  }
}
