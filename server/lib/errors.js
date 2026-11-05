export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError(401, 'AUTH_REQUIRED', message);

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'The requested resource was not found.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message, details) =>
  new AppError(409, 'CONFLICT', message, details);

export const unprocessable = (message, details) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
