import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const originGuard = (req, res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin) {
    if (!env.corsOrigins.includes(origin)) {
      return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed.'));
    }
  }

  // Require JSON content type for requests with bodies to force a CORS preflight.
  const contentLength = req.headers['content-length'];
  const hasBody = contentLength && Number(contentLength) > 0;
  if (hasBody) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Content-Type must be application/json.'));
    }
  }

  return next();
};

export { originGuard as default };