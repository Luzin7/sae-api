import createError from '@fastify/error';
export const NotFoundError = createError('NOT_FOUND', '%s not found', 404);
export const ForbiddenError = createError('FORBIDDEN', 'Access denied', 403);
export const ConflictError = createError('CONFLICT', '%s already exists', 409);
export const UnauthorizedError = createError('UNAUTHORIZED', 'Unauthorized', 401);
export const BadRequestError = createError('BAD_REQUEST', '%s', 400);
//# sourceMappingURL=errors.js.map