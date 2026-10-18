# Where our tree differs from upstream Postiz

**Ground truth is `git diff BASE_SHA HEAD`** (BASE_SHA in `baseline.env`); run `./sync-status.sh divergences` for the live list
(at the last check: 23 files added, 127 modified, 4 deleted, ignoring translations). This page explains *why* per cluster, so a sync
knows where **our version wins** and an upstream change needs porting by hand instead of taking the file.

Update this page when you add a new area of divergence. It is curated, not generated.

## Ours wins (do not take upstream's version of these files)

### Billing and payments (Razorpay, INR/USD, plan tiers)
- `libraries/nestjs-libraries/src/services/payment/providers/razorpay.provider.ts` (ours), `payment.providers.ts`, `payment.provider.manager.ts`
  (`DEFAULT_WEB_PAYMENT_PROVIDER`), `services/stripe.service.ts`
- `.../database/prisma/subscriptions/{pricing.ts,pricing.razorpay.ts,subscription.service.ts,subscription.repository.ts}`
- `apps/backend/src/api/routes/billing.controller.ts`, `dtos/billing/billing.subscribe.dto.ts`
- frontend `components/billing/*` (including ours `purchase.lifetime.razorpay.tsx`), `components/layout/check.payment.tsx`,
  `components/new-layout/billing.after.tsx`, `app/(app)/(site)/billing/*`
- `schema.prisma` (Razorpay/USD fields), `.env.example` (RAZORPAY_*, DEFAULT_WEB_PAYMENT_PROVIDER)
- Why: upstream is Stripe-first. Any upstream billing/quota change must be re-implemented against Razorpay and `pricing.ts`.
  Lifetime offer is commented out; AI video line is gated by `AI_VIDEO_GENERATION_ENABLED`.

### Branding (SocioBird, not Postiz)
- logos/favicons (`apps/frontend/public/*`), `components/ui/logo-text.component.tsx`, `components/new-layout/{layout.component,logo}.tsx`,
  auth pages and components, `apps/extension/manifest*.json`, `chatgpt-app-submission.json`, email text in notification/agencies/listmonk services,
  legal pages `app/(app)/(legal)/*` (ours), billing FAQ.
- Why: product rebrand (Sep 25). **After porting any upstream change, grep new user-facing strings for `Postiz`, `postiz.com`, `gitroom`.**

### Botsab (WhatsApp gateway) provider
- `integrations/social/botsab.provider.ts`, frontend `components/new-launch/providers/botsab/*`, `continue-provider/botsab/*`, `public/icons/platforms/botsab.png`,
  registered in `integration.manager.ts`, `all.providers.settings.ts`, `show.all.providers.tsx`, `continue-provider/list.tsx`.
- Not in upstream at all. Keep when merging provider lists.

### MCP upload widget (Claude and ChatGPT file upload)
- `apps/backend/src/api/routes/media.widget.controller.ts`, `services/auth/upload.widget.auth.middleware.ts`, `chat/tools/upload.widget*.ts`, `chat/ui/upload.widget.ts`,
  plus edits in `chat/{start.mcp,load.tools.service,agent.tool.interface}.ts`, `chat/tools/tool.list.ts`, `redis/redis.service.ts`.
- Ours. Upstream MCP changes touch the same files: merge carefully.

### Public API additions
- Superuser endpoints (org impersonation/debugging): `public.integrations.controller.ts`, `super.admin.guard.ts`, `permissions.service.ts`,
  `dtos/analytics/get.org.activity.dto.ts`, `admin-stats` repository/service.
- Public multipart upload (`/public/v1/upload/:endpoint`) and size enforcement on completion: `public.integrations.controller.ts`,
  `upload/r2.uploader.ts`, `upload/upload.factory.ts` (`multipartEnabled`).

### Channel list behaviour
- Unsupported providers marked "coming soon" (`add.provider.component.tsx`; 17 provider files differ from upstream only by a `comingSoon = true;` line, plus the `comingSoon` field in `social.integrations.interface.ts`).
  Threads was un-flagged because it works.
- YouTube title optional when posting to several platforms (`youtube.provider.ts` + frontend + settings DTO, #8).
- Botsab group/contact posts are handed to Botsab's campaign runner with fixed pacing (`GROUP_CAMPAIGN_OPTIONS`, #7).

## Smaller or infra-level differences

- `AI_VIDEO_GENERATION_ENABLED` kill switch (`videos/video.config.ts`, `video.manager.ts`).
- undici/Node fetch dispatcher fix (`dtos/webhooks/ssrf.safe.dispatcher.ts`).
- `apps/orchestrator/src/workflows/digest.email.workflow.v2.ts` (new version added; v1 untouched).
- Left menu "Docs" link (`components/layout/top.menu.tsx`).
- `.github/workflows/build-qat-image.yml` (manual image build, ours). Upstream's `staging-conflicts.yml` is deleted.
- `CLAUDE.md`, `.claude/` (this tracking), `.gitignore`, `package.json` / `pnpm-lock.yaml` (dependency and lockfile fixes).
- Translations (`libraries/react-shared-libraries/src/translation/locales/*`) differ from upstream; not analysed in detail.

## Found by reading the code (not in any single feature commit)

| What | Where |
|---|---|
| Reddit subreddit search resolves a pasted `r/name` or reddit.com URL | `reddit.provider.ts` (`subredditByName`) |
| Google Business Profile logs the real API response when no accounts/locations are found | `gmb.provider.ts` |
| `LinkedIn-Version` header pinned | `linkedin.provider.ts` |
| MCP/agent tool loading must not block the API from listening | `chat/load.tools.service.ts` |
| Organization selector tolerates a non-array response | `organization.selector.tsx` |
| Required Google user-data disclosure in the privacy policy | `(legal)/privacy/page.tsx` |
| **Database:** models that differ from the *baseline* are `Subscription` (payment-provider fields) and, since the Oct 2026 sync, the upstream-ported nullable columns `Post.batchId` (+ index) and `Integration.customName`. Both are additive; everything else is upstream's schema | `schema.prisma` |
| Farcaster provider and two other files carry build fixes for latent upstream bugs | commit `e2c9d7a` |

## Removed from upstream

See the `skipped` rows in `ledger.tsv`: Polotno designer, embedded billing, staging-conflicts workflow.

**Known gap:** Polotno is not fully removed. The component files and the npm dependency are gone, but `apps/frontend/src/app/polonto.css` (16.5k lines) is still
`@use`d by `global.scss` (with a `.editor .polonto *` rule), and `docker-compose.yaml` still sets `NEXT_PUBLIC_POLOTNO`. They are dead weight; `features.tsv` reports them as a warning.

## Added by the October 2026 upstream sync (TRIAGED_THROUGH `7113c6ce`)

These now exist in our tree but are **not** in `BASE_SHA`, so `git diff BASE_SHA HEAD` shows them as "ours". Do not port them again.
Decisions per upstream change are in `ledger.tsv` (key = PR number or sha), proofs in `features.tsv`.

| What | Where / note |
|---|---|
| CVE-2026-94455 enterprise token check; CVE-2026-94456 `makeSecureId` for OAuth state/secrets/codes | `enterprise.controller.ts`, `services/make.secure.id.ts` (39 files) |
| New creation modal, new date picker, tags editing, calendar current-hour line, responsive launches/media, mobile top bar + bottom sheet | `components/new-launch/*`, `launches/*`, `media/media.component.tsx` (Polotno/designer button stays removed, AI-video switch stays) |
| Group schedules: one post for several channels with their own dates | `Post.batchId`, posts DTO/service/repository, public API strips per-channel `date` |
| Channel rename and edit group name; channel filter on `/posts/list`; `GET /posts/:id/release-url` (stored `releaseURL` only, no TikTok resolve) | `Integration.customName`, `integrations.controller.ts` |
| Billing history panel; Razorpay `getInvoices` (hosted invoice link, no PDF) | `payment.provider.interface.ts`, `razorpay.provider.ts`, `billing.history.component.tsx` |
| Public API `GET /media`, `GET /me`, MCP `mediaListTool`; superadmin include-deleted header and reset-AI-credits endpoint | `public.integrations.controller.ts`, `chat/tools/media.list.tool.ts` |
| Higher `maxConcurrentJob` for LinkedIn, Threads, Bluesky, Mastodon, Pinterest, Slack, Twitch, VK, WordPress, Whop | provider files |
| `.mov` and `.mp4` accepted interchangeably when completing a multipart upload | upload completion in the R2 uploader |
| Small fixes: Instagram limit mappings, uploader keeps batch, post-save error toast, RTL editor, duplicate refresh-error email, delete-account with disabled members | see ledger |

**Deliberately not taken (still true):** Stripe billing pages and conversion tracking, HubSpot, clipping, ChatGPT submission files, MCP upload widget changes, top-menu/settings moves, Facebook video title, TikTok resolve logic,
`--accept-data-loss` removal from `prisma-db-push` (our container start relies on it).

**Deferred (ask again next sync):** Mastra table mirror in `schema.prisma` (needs the Mastra 1.21 to 1.67 upgrade; today `db push --accept-data-loss` can drop Mastra tables the schema does not mirror),
TikTok publish fixes (TikTok is coming-soon), inline pictures in the editor (flags are off; needs X article backend), `autopost`/`missing-post` continue-as-new and the send-email workflow (need NEW versioned workflows),
and about 13 vaguely named upstream commits listed as `deferred` in the ledger.
