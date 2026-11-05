import { randomUUID } from 'node:crypto';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, supabaseConfigured } from './config/env.js';
import { checkDatabase } from './db/pool.js';
import { AppError } from './lib/errors.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { originGuard } from './middleware/originGuard.js';
import apiRouter from './routes/index.js';

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);

  if (env.corsOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(
    new AppError(
      403,
      'CORS_NOT_ALLOWED',
      'This origin is not allowed to call the API.',
    ),
  );
}

const healthHandler = async (req, res) => {
  const database = await checkDatabase();
  const auth = supabaseConfigured ? 'configured' : 'not_configured';
  const ok = database.status === 'ok' && supabaseConfigured;

  res.status(ok ? 200 : 503).json({
    data: {
      status: ok ? 'ok' : 'degraded',
      service: 'systems-index-api',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
      checks: {
        database,
        auth,
      },
    },
  });
};

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  if (env.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86_400,
    }),
  );
  app.use(originGuard);
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isProduction) {
    app.use(morgan('dev'));
  }

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
