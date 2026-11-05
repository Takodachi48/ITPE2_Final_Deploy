import 'dotenv/config';

const read = (name, fallback = undefined) => {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;

  const trimmed = String(value).trim();
  return trimmed === '' ? fallback : trimmed;
};

const PLACEHOLDER_PATTERN =
  /(YOUR_|your-project|your-password|your-region|PROJECT_REF|REPLACE_ME|changeme|example\.com)/i;

const isPlaceholder = (value) => !value || PLACEHOLDER_PATTERN.test(value);

const nodeEnv = read('NODE_ENV', 'development');
const sameSite = (read('COOKIE_SAME_SITE', 'lax') || 'lax').toLowerCase();
const allowedSameSite = ['lax', 'strict', 'none'];

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parsePositiveNumber(read('PORT', '4000'), 4000),
  host: read('HOST', '0.0.0.0'),
  trustProxy: read('TRUST_PROXY', 'false') === 'true',
  corsOrigins: (read('CORS_ORIGIN', 'http://localhost:5173,http://127.0.0.1:5173') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    url: read('DATABASE_URL'),
    ssl: read('DATABASE_SSL', 'true') === 'true',
    sslRejectUnauthorized: read('DATABASE_SSL_REJECT_UNAUTHORIZED', 'false') === 'true',
    poolMax: parsePositiveNumber(read('DATABASE_POOL_MAX', '10'), 10),
  },
  supabase: {
    url: read('SUPABASE_URL'),
    anonKey: read('SUPABASE_ANON_KEY'),
    serviceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
  },
  cookies: {
    accessName: read('ACCESS_TOKEN_COOKIE', 'si_access_token'),
    refreshName: read('REFRESH_TOKEN_COOKIE', 'si_refresh_token'),
    secure: read('COOKIE_SECURE', nodeEnv === 'production' ? 'true' : 'false') === 'true',
    sameSite: allowedSameSite.includes(sameSite) ? sameSite : 'lax',
    domain: read('COOKIE_DOMAIN'),
    refreshMaxAge:
      parsePositiveNumber(read('REFRESH_TOKEN_MAX_AGE_DAYS', '30'), 30) *
      24 *
      60 *
      60 *
      1000,
  },
  storage: {
    topicBucket: read('STORAGE_TOPIC_BUCKET', 'topic-files'),
    uploadBucket: read('STORAGE_UPLOAD_BUCKET', 'quiz-uploads'),
    signedUrlTtlSeconds: parsePositiveNumber(
      read('SIGNED_URL_TTL_SECONDS', '120'),
      120,
    ),
    maxFileMb: parsePositiveNumber(read('MAX_FILE_MB', '25'), 25),
    maxImageMb: parsePositiveNumber(read('MAX_IMAGE_MB', '5'), 5),
  },
  groq: {
    apiKey: read('GROQ_API_KEY'),
    model: read('GROQ_MODEL', 'openai/gpt-oss-120b'),
    timeoutMs: parsePositiveNumber(read('GROQ_TIMEOUT_MS', '60000'), 60000),
    maxInputChars: parsePositiveNumber(read('GROQ_MAX_INPUT_CHARS', '12000'), 12000),
  },
  defaultTimezone: read('DEFAULT_TIMEZONE', 'Asia/Manila'),
  passwordResetRedirectUrl: read(
    'PASSWORD_RESET_REDIRECT_URL',
    'http://localhost:5173',
  ),
};

export const databaseConfigured = !isPlaceholder(env.database.url);
export const supabaseConfigured =
  !isPlaceholder(env.supabase.url) && !isPlaceholder(env.supabase.anonKey);
export const supabaseServiceConfigured =
  supabaseConfigured && !isPlaceholder(env.supabase.serviceRoleKey);
export const groqConfigured = !isPlaceholder(env.groq.apiKey);

if (!env.corsOrigins.length) {
  console.warn('[config] CORS_ORIGIN is empty. Browser API requests will be blocked.');
}

if (env.cookies.sameSite === 'none' && !env.cookies.secure) {
  console.warn(
    '[config] COOKIE_SAME_SITE=none requires COOKIE_SECURE=true in modern browsers.',
  );
}
