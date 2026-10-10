# Architecture

Facts below were verified against the code on 2026-10-10 unless marked otherwise.

## Repositories

| Repo | What it is | Where it runs |
|---|---|---|
| `halleshubham/sociobird-app` (this repo) | the product: backend, orchestrator, frontend, shared libraries | Coolify apps `postiz-v2` (production) and `postiz-v2-qat` (QAT) |
| `halleshubham/sociobird-site` | marketing site (static HTML behind nginx), plan cards, usage pages | Coolify app `sociobird-site`, sociobird.app |
| `halleshubham/shackyapps-landing` | shackyapps.in landing + Docusaurus docs; SocioBird guides in `docs-site/sociobird/` | Coolify app `shackyapps-landing`, shackyapps.in/docs/sociobird |
| `halleshubham/SocioBirdMobile` | Android client (Kotlin, Compose, Retrofit) using the public API; builds a debug APK in GitHub Actions | not deployed; APK installed by hand |
| `gitroomhq/postiz-app` | upstream Postiz. See [../upstream/README.md](../upstream/README.md) | n/a |

## This monorepo

pnpm workspace (use pnpm only). Node 22 in the image.

```
apps/backend       NestJS API (port 3000). Controllers only; logic lives in libraries/
apps/orchestrator  NestJS + Temporal worker: workflows, activities, one worker per provider queue (health on 3002)
apps/frontend      Next.js app router (port 4200), Tailwind 3, SWR via useFetch
apps/commands      Nest command-line tasks
apps/extension     browser extension
apps/sdk           SDK package
libraries/nestjs-libraries   server logic shared by backend and orchestrator (see below)
libraries/react-shared-libraries   shared React helpers/components, translations (locales)
libraries/helpers  small shared utils (custom.fetch with useFetch, etc.)
var/docker/        nginx.conf and docker helper scripts
```

`CLAUDE.md` rule: backend layering is **DTO → Controller → (Manager) → Service → Repository**, Prisma only
(no raw SQL), and most server logic belongs in `libraries/nestjs-libraries`.

### Key areas of `libraries/nestjs-libraries/src`

| Folder | Purpose |
|---|---|
| `database/prisma/*` | Prisma schema (`schema.prisma`), repositories and services per domain (posts, integrations, organizations, subscriptions, media, admin-stats...) |
| `integrations/social/*` | one provider per channel (about 39 files). Every provider implements `social.integrations.interface.ts`. Manager: `integration.manager.ts` |
| `dtos/posts/providers-settings/*` | per-provider post settings DTOs (for example `youtube.settings.dto.ts`) |
| `upload/*` | storage abstraction (`upload.factory.ts`: `local` or `cloudflare`), R2 multipart (`r2.uploader.ts`), streaming upload engine, validation (`custom.upload.validation.ts`), optional media normalizer (RunPod) |
| `services/payment/*` | payment providers (Stripe from upstream, Razorpay ours) and `payment.provider.manager.ts` |
| `chat/*` | AI agent, MCP server (`start.mcp.ts`), tools, the upload widget tools |
| `temporal/*` | Temporal client wiring |
| `videos/*` | AI video generation (kill switch `AI_VIDEO_GENERATION_ENABLED`) |

## Runtime inside the container

`Dockerfile.dev` (base `node:22.20-bookworm-slim`) builds everything with `pnpm run build` and starts:

```
CMD nginx && pnpm run pm2
```

- nginx listens on **5000**: `/api/` → backend `:3000`, `/uploads/` → local upload directory, `/` → frontend `:4200`. `client_max_body_size 2G`.
- `pnpm run pm2` = `pm2 delete all`, then **`prisma db push --accept-data-loss`**, then PM2 starts backend, frontend and orchestrator in parallel.
  Schema changes are applied automatically on every container start. Be careful with destructive schema edits.
- Orchestrator prints `Starting Nest application`, then `Orchestrator health check listening on port 3002`,
  then one `Worker state changed ... taskQueue: '<queue>' ... RUNNING` per queue (about 34: `main` plus one per provider).

## Data stores and external services

- **PostgreSQL** (Prisma 6.5.0), **Redis**, **Temporal** (own Coolify app per environment, with Elasticsearch, apparently for Temporal visibility (inferred)).
- **Object storage:** Cloudflare R2 (`STORAGE_PROVIDER=cloudflare`). Bucket `postiz`, public URL on `r2-social.shackyapps.in`.
  **Production and QAT share this bucket.**
- **Payments:** Razorpay (INR and USD) and Stripe, chosen by `DEFAULT_WEB_PAYMENT_PROVIDER`.
- Email, AI (OpenAI), channel OAuth apps: see `.env.example` for the variable names.

## Publishing pipeline (the part that matters most)

1. A post is saved from the calendar, the API, an agent, or auto-post.
2. The backend starts a **Temporal workflow** for it (post workflows are versioned files `post.workflow.v1.0.1` ... `v1.1.2`
   in `apps/orchestrator/src/workflows/post-workflows/`, exported from `workflows/index.ts`).
3. At the scheduled time, activities in the orchestrator call the provider's `post()`.
4. The orchestrator runs one Temporal worker per provider task queue plus `main`.
   **If the orchestrator is silent, nothing publishes.** See OPERATIONS.md.

**Workflow rules (from CLAUDE.md, enforced by experience):** never edit a workflow file that is in `origin/main`
(changing it fails in-flight activities). Add a new versioned workflow and point callers at it. Never change an
existing activity's parameters; add a new activity. Example already in the tree: `digest.email.workflow.v2.ts`.

## Public API and auth

- Public API lives in `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`, served under `/api/public/v1`.
- Auth middleware: `services/auth/public.auth.middleware.ts`. The `Authorization` header carries the **raw org API key**
  (Settings → Developers), or an OAuth token starting with `pos_`. The app's own routes use a cookie JWT.
- Uploads: `POST /public/v1/upload` (streams through the server), `POST /public/v1/upload-from-url`, and
  `POST /public/v1/upload/:endpoint` for **multipart direct-to-R2** (`create-multipart-upload`, `sign-part`, `list-parts`,
  `complete-multipart-upload`, `abort-multipart-upload`). The web app uses the same flow through `/api/media/:endpoint`.
  Parts go straight to R2 so Cloudflare's proxy body cap (100 MB on Free/Pro) does not apply.
  Completion validates the file type by content sniffing and enforces `getMaxSize` (images 10 MB, video 1 GB).
- Superuser-only endpoints (org impersonation and debugging) are guarded by `super.admin.guard.ts`.

## Billing and plans

- Tiers in code: `STANDARD`, `TEAM`, `PRO`, `ULTIMATE`. Shown to customers as **Solo, Team, Agency, Scale**.
- Limits and feature flags: `database/prisma/subscriptions/pricing.ts` (channels, `team_members`, `autoPost`, `image_generator`,
  `webhooks`, `public_api`, ...). INR prices: `pricing.razorpay.ts` (799 / 1999 / 4999 / 9999 per month). USD: 9 / 19 / 49 and custom for Scale.
- **The plan cards on sociobird.app are hand-copied** (`sociobird-site/index.html` and `global.html`, `PLANS` array).
  When pricing or gating changes here, change the site too, and only list features that exist in `pricing.ts`.
  There is no approval workflow, no "priority support" and no "white-glove onboarding" feature; do not advertise them.
- `IS_GENERAL` changes paywall/branding behaviour. Read commit `3cbce54` before touching that logic.

## Channels and WhatsApp

- 13+ channels are supported (Facebook, Instagram, X, LinkedIn, YouTube, Mastodon, Telegram, WordPress, Medium,
  dev.to, Hashnode, Lemmy, ListMonk and more). Providers that are not ready are flagged "coming soon" in
  `apps/frontend/src/components/launches/add.provider.component.tsx`.
- **Botsab** is our WhatsApp gateway (a separate product). Provider: `integrations/social/botsab.provider.ts`; frontend:
  `components/new-launch/providers/botsab/`. It applies anti-ban pacing and retries Baileys "No sessions" errors.

## AI, MCP and agents

`libraries/nestjs-libraries/src/chat/`: agent tools, MCP server (API-key URL and OAuth variants), and an **upload widget**
for Claude/ChatGPT (`media.widget.controller.ts`, `upload.widget.*`, auth in `upload.widget.auth.middleware.ts`). Ours, not upstream.

## Frontend conventions

Next.js app router under `apps/frontend/src/app/`: `(app)/(site)` for the signed-in app, `auth/`, `(preview)/p/[id]`,
`(legal)` (terms and privacy, ours). UI primitives in `components/ui`. Fetch with SWR through `useFetch`; one SWR
hook per file/function (see CLAUDE.md for the lint-safe pattern). Translations in
`libraries/react-shared-libraries/src/translation/locales`.

## The mobile app (SocioBirdMobile)

Kotlin + Compose + Hilt + Retrofit. Talks only to `/api/public/v1` with the org API key. Files over 50 MB upload in
10 MB parts straight to R2 using the multipart endpoints above (falls back to `/upload` on servers without them).
Brand quick-select on Create Post, progress per part, YouTube title from the first line.
Package name is still `com.postiz.mobile` internally; the app name is SocioBirdMobile.
