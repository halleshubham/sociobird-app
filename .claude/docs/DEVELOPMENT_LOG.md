# Development log

Newest first. One entry per meaningful piece of work: date, what, why, PR numbers, surprises.
PR numbers are in `halleshubham/sociobird-app` unless a repo is named. Add yours at the top.

---

## 2026-10-10

- **Developer docs and upstream-sync tracker** added under `.claude/` (this folder and `.claude/upstream/`). Baseline of the
  last upstream sync recorded as Postiz `48490b81` (2026-09-17). See `../upstream/README.md`.
- **Plan features corrected on the marketing site** (`sociobird-site` #6, #7, #8, #9): removed the invented "Team approvals",
  "Priority support" and "White-glove onboarding" claims, replaced with real limits (webhooks, Auto Post, AI image generator);
  usage pages now say "draft and review" because there is no approval workflow; meta descriptions say "13+ channels".
  **Lesson:** plan copy must be checked against `pricing.ts`, not copied from older marketing text.
- **Code-level feature verification** (`.claude/upstream/features.py`, `FEATURES.md`, `features.tsv`): replaced "trust the commit history" with tree-based checks.
  Found: Polotno is only partly removed (16.5k-line CSS and a compose var remain), a Botsab retry/sanitising claim from commit messages was no longer in the code,
  and fork-only changes to Reddit, GMB, LinkedIn and MCP loading that no divergence note mentioned. `git log BASE..HEAD` is misleading (it includes Dec 2025 upstream-line commits).
- **A4 flyer** for sociobird.app generated (HTML to PDF with Playwright; not stored in the repo).
- **Server memory survey** of the three Coolify servers (see OPERATIONS.md). No server was short of memory.
- **Docs site** (`shackyapps-landing` #18): media library limits, "Upload media with the API", a Mobile app page, FAQ entry.
- **Mobile app** (`SocioBirdMobile` #1, #2, #3 merged): rebrand to SocioBirdMobile, brand quick-select merged from `develop`,
  multipart direct-to-R2 upload with progress inside each part, videos of unknown size use multipart, clearer storage errors.

## 2026-10-09

- **Public multipart uploads** (#15, deployed as `v1.0.9-sociobird` to QAT and production): `POST /public/v1/upload/:endpoint`
  exposes the web app's R2 multipart flow to API-key clients so files over the 100 MB Cloudflare proxy cap upload straight to R2.
  `completeMultipartUpload` now also enforces `getMaxSize` (images 10 MB, video 1 GB) because parts bypass the server.
  Tested on QAT with a 125 MB file (5 parts), an 11 MB image rejected, no-auth 401.
- **Reverted the CI pipeline** (#14 reverting #10, #11, #12): auto image build on merge, boot check against throwaway postgres/redis/temporal,
  and the Coolify health-check script. They worked on QAT but the owner chose not to keep them. Images are built manually again.
- **Production moved to `v1.0.8-sociobird` then `v1.0.9-sociobird`.** First `v1.0.8` attempt failed to pull on the host (containerd layer error); retry succeeded.
  Orchestrator booted with all 34 queues; re-checks at 5 minutes were clean.
- Closed #13 (boot-check hardening, moot after the revert).

## 2026-10-04 to 2026-10-06 (incident)

- Scheduled posts (08:30 IST) were not published after production was moved to a newer image: the orchestrator was "online" in PM2
  but silent, so no queue polled. Rolled back to `v1.0.5-sociobird`. Images `v1.0.6`, `v1.0.7`, `sha-eb2b53a3` were involved.
  Root cause not found; details in OPERATIONS.md.
- Added then removed safeguards (#10, #11, #12). A Coolify health-check gate was proven on QAT.
- #9: "Docs" item in the left menu linking to the SocioBird docs. #8: YouTube title no longer required when posting to several platforms.

## 2026-10-01 to 2026-10-03

- #7: Botsab group/contact posts bypassed anti-ban pacing (fixed): `botsab.provider.ts` now hands them to Botsab's campaign runner with `GROUP_CAMPAIGN_OPTIONS`.
  (A Sep 23 commit added a "No sessions" retry in our provider; the code no longer contains it, so pacing and retries are Botsab's job now. Same for phone-number sanitising: no longer in our provider.)
- Docs written for SocioBird in `shackyapps-landing/docs-site/sociobird/` (11 pages, real screenshots, four tutorial videos) and linked from the app and from sociobird.app.
  Several docs were first written without running the app and were rewritten from the live QAT app after review. **Run the app before documenting it.**

## 2026-09-23 to 2026-09-27

- Rebrand "Shacky Postiz" to **SocioBird** (Sep 25), USD billing through Razorpay next to INR, email/branding fixes, paywall USD/INR toggle.
- Region-based pricing was added and reverted on Sep 19 (INR vs USD by region); replaced by an explicit toggle.
- Fork-only features added: **MCP upload widget** (Claude/ChatGPT file uploads), **superuser public API endpoints** for org impersonation/debugging,
  Botsab hardening, `digest.email.workflow.v2` (new version instead of editing the old workflow).
- Manual workflow `build-qat-image.yml` added to build and push an image to ghcr.

## 2026-09-17 to 2026-09-19

- **Upstream sync:** merged Postiz `gitroomhq/postiz-app` main (tip `48490b81`, "serve the ChatGPT app on /mcp-oauth-chatgpt") into `sync/upstream-main`,
  then merged our `stable-v2.10.1-razorpay` line on top (merge commits `1a714e1`, `6cae887`).
- Follow-up fixes the merge needed: Razorpay Checkout.js flow restored, pnpm lockfile mismatch, two latent upstream build blockers,
  undici/Node fetch dispatcher mismatch, new-signup billing screen for Razorpay orgs, payment-confirmation poll timeout.
- Removed the **unlicensed Polotno designer** (files `launches/polonto*`). Do not re-adopt it from upstream.
- Added public Terms of Service and Privacy pages, `AI_VIDEO_GENERATION_ENABLED` kill switch, "coming soon" flags for unsupported providers,
  commented out the lifetime purchase offer on the billing page, new logo.
