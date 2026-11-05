import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `There is no API route at ${req.method} ${req.originalUrl}.`,
    },
    requestId: req.id,
  });
}

const mapDatabaseError = (error) => {
  switch (error.code) {
    case '23505':
      return new AppError(
        409,
        'DUPLICATE_RECORD',
        'That record already exists. Check unique values such as the slug, module id, presenter name, or video URL.',
      );
    case '23503':
      return new AppError(
        422,
        'RELATED_RECORD_MISSING',
        'A referenced record does not exist. Check the theme or presenter ids.',
      );
    case '23514':
      return new AppError(
        422,
        'CONSTRAINT_FAILED',
        'The submitted values do not satisfy the database constraints.',
      );
    case '42P01':
      return new AppError(
        503,
        'DATABASE_NOT_INITIALIZED',
        'The database schema has not been applied. Run npm run db:schema.',
      );
    case '28P01':
    case '28000':
      return new AppError(
        503,
        'DATABASE_AUTH_FAILED',
        'The API could not authenticate with Postgres. Check DATABASE_URL.',
      );
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case '57P01':
      return new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'The database is unavailable right now. Try again shortly.',
      );
    case '57014':
      return new AppError(
        503,
        'DATABASE_TIMEOUT',
        'The database query took too long. Try again.',
      );
    default:
      return null;
  }
};

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some of the submitted values are invalid.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      },
      requestId: req.id,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId: req.id,
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body is not valid JSON.',
      },
      requestId: req.id,
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
      },
      requestId: req.id,
    });
  }

  const databaseError = mapDatabaseError(error);
  if (databaseError) {
    return res.status(databaseError.status).json({
      error: {
        code: databaseError.code,
        message: databaseError.message,
      },
      requestId: req.id,
    });
  }

  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on the server. Try again.',
    },
    requestId: req.id,
  });
}
