# Class LMS

Class LMS is a class learning management system for faculty and students. Faculty create subjects and topics, publish content and quizzes, grade uploaded submissions, and export reports; students join with a code, study scheduled topics, take quizzes, and track grades.

> Repurposed from the earlier “Systems Index” ITPE project. Some legacy public module/content routes and data remain in the codebase, but the primary app is the LMS.

## Features

- **Auth & roles:** Supabase Auth with HttpOnly cookie sessions; `admin`, `faculty`, `student` roles; faculty approval flow.
- **Subjects:** subject settings (term/school year, passing %), join codes, enrollment, roster.
- **Topics & content:** scheduled topics, text/markdown/link/file/presentation blocks, student access gating/progress.
- **Quizzes:** built-in auto-graded quizzes (MCQ/text), uploaded/manual-graded quizzes, attempts, regrading.
- **AI quiz generation (optional):** faculty can select a topic `.pptx` and generate 10–20 draft MCQs via Groq (`officeparser` + `groq-sdk`), preview, then save as a built-in draft quiz (server-only `GROQ_API_KEY`; no save when attempts exist).
- **Reports & exports:** faculty report/grades views, PDF summary, CSV/Excel detail exports.
- **Storage:** Supabase Storage signed upload/download URLs for topic files and quiz attachments/uploads.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Vite |
| API | Node.js (>=22.13.0), Express 5, Zod, `pg` |
| Database | Supabase Postgres |
| Auth/Storage | Supabase Auth + Supabase Storage |
| AI (optional) | Groq API (`openai/gpt-oss-120b` default) |
| Security | Helmet, CORS allow-list, origin guard, HttpOnly cookies, rate limits |

## Local development

```bash
cp .env.example .env
# fill required placeholders (Supabase/Postgres; Groq optional)
npm ci
npm run dev:all
```

- Web: Vite dev server (default `http://localhost:5173`)
- API: `http://localhost:4000` (proxied by Vite for `/api`)
- Health: `GET /health` or `GET /api/v1/health`

Useful scripts:

```bash
npm run dev          # frontend
npm run dev:api      # API with --watch
npm run dev:all      # both
npm run build        # production frontend build
npm run start        # production API start
npm run test         # node --test
npm run lint         # ESLint
npm run db:schema    # apply base schema
npm run db:migrate   # apply pending migrations
npm run storage:setup
npm run db:seed:test-users  # local/test only; refuses production
```

## Configuration

See `.env.example`. Key notes:

- **Server-only secrets:** `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` must never be exposed to the frontend or `VITE_*` vars.
- **Frontend:** only `VITE_*` vars are exposed by Vite. Local/proxied dev uses `VITE_API_BASE_URL=/api/v1`.
- **Cross-site deployment (Vercel frontend + Render API):** set API `CORS_ORIGIN` to the exact frontend origin(s), `TRUST_PROXY=true`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`; set frontend `VITE_API_BASE_URL=https://<render-api>/api/v1` (build-time; redeploy to change).
- **AI quiz generation:** set `GROQ_API_KEY` on the API server (optional). Default model `openai/gpt-oss-120b`; configure via `GROQ_MODEL`.

## Deployment

- **Recommended:** Render for the API + Vercel for the SPA. See [`docs/DEPLOY.md`](docs/DEPLOY.md) and `render.yaml`.
- **Node version:** `>=22.13.0` (`package.json` `engines`).
- **API health check:** `/api/v1/health`.
- **Vercel SPA rewrite:** `vercel.json` rewrites routes to `index.html`; it does **not** host the API.
- `npm run deploy` (GitHub Pages/static) is legacy and not suitable for the full authenticated API-backed LMS.

## Docs

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Render + Vercel deployment
- [`docs/API.md`](docs/API.md) — API reference
- [`docs/GUIDE.md`](docs/GUIDE.md) — faculty/student usage guide
- [`PLANS/`](PLANS/) — internal planning/spec/checklist history (include only if you intend to publish it)

## Public repo hygiene

If copying to a new public repo, **exclude** `.env`, `node_modules/`, `dist/`, `.git/`, local logs, and any secret values. Include `docs/DEPLOY.md` if you keep the README link above. Never commit `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, or `GROQ_API_KEY`.
