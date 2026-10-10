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
| **Database:** the only Prisma model that differs from upstream is `Subscription` (payment-provider fields); everything else is upstream's schema | `schema.prisma` |
| Farcaster provider and two other files carry build fixes for latent upstream bugs | commit `e2c9d7a` |

## Removed from upstream

See the `skipped` rows in `ledger.tsv`: Polotno designer, embedded billing, staging-conflicts workflow.

**Known gap:** Polotno is not fully removed. The component files and the npm dependency are gone, but `apps/frontend/src/app/polonto.css` (16.5k lines) is still
`@use`d by `global.scss` (with a `.editor .polonto *` rule), and `docker-compose.yaml` still sets `NEXT_PUBLIC_POLOTNO`. They are dead weight; `features.tsv` reports them as a warning.
