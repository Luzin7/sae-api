export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'INVALID_OPERATION';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
