import { DomainError, type DomainErrorCode } from './domain-error.js';

export class InvalidEffortInputError extends DomainError {
  readonly code: DomainErrorCode = 'VALIDATION';
  readonly httpStatus = 400;

  constructor(message = 'Valor inválido para Pontos de Esforço.') {
    super(message);
  }
}
