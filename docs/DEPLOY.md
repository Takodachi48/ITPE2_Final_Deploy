# Deploying (Render API + Vercel frontend)

This app is split: an Express/Node API (`server/`) and a Vite/React SPA (`src/`, `dist/`). For a new public repo, copy only what you need (source, `server/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `.env.example`, `vercel.json`, `render.yaml`, this doc). **Do not copy** `.env`, `node_modules/`, `dist/`, `.git/`, or `.kilo/`.

## 1) Render (API)

Use a **Web Service** (not a Static Site). `render.yaml` provides defaults; set secrets in the Render dashboard.

- **Runtime:** Node (requires `>=22.13.0` per `package.json` `engines`; set Render Node version accordingly).
- **Build:** `npm ci`
- **Start:** `npm start` (runs `node server/index.js`; Render injects `PORT`)
- **Health check:** `/api/v1/health` (returns 503 if DB/Auth not configured/misconfigured — useful for catching bad env)

Required env vars (Render):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `CORS_ORIGIN` | your Vercel origin(s), exact, comma-separated (e.g. `https://your-app.vercel.app`) |
| `COOKIE_SAME_SITE` | `none` (cross-site frontend↔API) |
| `COOKIE_SECURE` | `true` |
| `DATABASE_URL` | Supabase Postgres connection string (session pooler/URI) |
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` (typical for Supabase; adjust if you use strict certs) |
| `SUPABASE_URL` | project URL |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (**server-only secret**) |
| `GROQ_API_KEY` | Groq key for AI quiz generation (**server-only secret**, optional feature) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (default) |
| `PASSWORD_RESET_REDIRECT_URL` | your Vercel app URL (where reset links land) |

Notes:
- Cookie auth uses HttpOnly cookies; cross-site requires `CORS_ORIGIN` to include the exact Vercel origin, `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, and `TRUST_PROXY=true`.
- State-changing requests must send `Content-Type: application/json` (origin guard). The SPA already does.
- Free Render instances may spin down; first request can be slow.

## 2) Vercel (frontend)

Deploy the SPA. `vercel.json` already rewrites all routes to `index.html`.

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm ci` (or default)

Required env var (Vercel, **build-time** for Vite):

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-RENDER-API.onrender.com/api/v1` |

Vite inlines `VITE_*` at build time, so changing it requires a redeploy. `VITE_API_BASE_URL` is a public client URL (not a secret).

## 3) Supabase/Auth checklist

- Run migrations/schema as needed against the same `DATABASE_URL` the API uses.
- In Supabase Auth settings, allow/confirm the redirect/site URLs you use (including `PASSWORD_RESET_REDIRECT_URL`).
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` only on Render (never in Vercel `VITE_*`).

## 4) Verify

1. `GET https://YOUR-RENDER-API.onrender.com/api/v1/health` → `200` with checks OK.
2. Open Vercel app, sign in/register, confirm cookies work across sites (Network: responses set cookies; requests include `credentials`).
3. Test a protected action and AI quiz generation (if `GROQ_API_KEY` set).
4. Hard refresh on a deep route (e.g. `/faculty/...`) — `vercel.json` rewrite should serve the SPA.

## 5) “Necessary files” for a clean public repo

Copy: `server/`, `src/`, `public/` (if present), `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `.env.example`, `.gitignore`, `vercel.json`, `render.yaml`, `README.md`, `docs/DEPLOY.md` (and `docs/` you want public). Optionally `PLANS/` only if you intend to keep internal planning public. Exclude secrets, build artifacts, and `node_modules/`.
