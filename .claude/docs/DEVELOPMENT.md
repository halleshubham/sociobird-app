# Development guide

`/CLAUDE.md` has the binding coding rules. This file is the practical "how do I get a change out" guide.

## Local commands (run from the repo root, pnpm only)

```
pnpm install                 # also runs prisma generate
pnpm run dev                 # extension + orchestrator + backend + frontend
pnpm run dev-backend         # backend + frontend only
pnpm run build               # frontend, backend, orchestrator
pnpm run prisma-db-push      # apply schema (destructive flags! see ARCHITECTURE.md)
pnpm test                    # jest
```

Lint only works from the root. Cloud/Claude sessions usually have **no `node_modules`**, so you cannot typecheck locally;
rely on the CI "Build" check on the PR, and read neighbouring code to mirror its patterns.

## Coding rules that bite (summary of CLAUDE.md)

- Backend: DTO → Controller → Service → Repository, Prisma only, logic in `libraries/nestjs-libraries`.
- **Generic code stays generic.** No `if (facebook)` in shared code. Add a method to the provider interface and implement it per provider.
- **Workflows and activities are immutable once in `origin/main`.** Add `...v1.x.y` / new activity, then repoint callers.
- Frontend: SWR through `useFetch`, one hook per SWR call, no `eslint-disable` on hook rules, native components, Tailwind 3, ignore `--color-custom*`.
- The system is in production: think migration and backwards compatibility before changing data shapes.
- Look for a similar existing pattern before writing a new one. Avoid new files that are pure algorithms.

## Branches and PRs

- Work on the branch the session or user names. Do **not** open a PR unless asked.
- PR body must follow `.github/PULL_REQUEST_TEMPLATE.md`: a detailed "What kind of change" (type, area, key file/function, what stayed the same)
  and a `# QA` section with numbered `1. [ ] step` lines (setup, action, expected result). No `N/A`, no placeholders.
- CI: the **Build** workflow runs on every push and PR. The frontend build can fail once on a Google Fonts fetch;
  re-run the failed job once before investigating. Do not merge on red without understanding why.
- If your session branch already exists remotely from an earlier, squash-merged PR, compare trees
  (`git diff --stat origin/<branch> origin/main` is empty) and push with `--force-with-lease=<branch>:<old-sha>`; otherwise the push is rejected.

## Building and releasing an image

Production runs an immutable image tag from `ghcr.io/halleshubham/sociobird-app`. There is **no automatic image build on merge**
(an auto-build plus boot-check pipeline was tried and reverted, see the log). To release:

1. Merge to `main`.
2. Run the manual workflow **"Build QAT Image"** (`.github/workflows/build-qat-image.yml`) on `main` with input `tag`, for example `v1.0.10-sociobird`.
   Tag convention: `v1.0.N-sociobird`, next number after the highest in the log. Takes about 7 minutes.
3. **Deploy to QAT first**, verify, then production. Never deploy production without a rollback tag in hand.

### Deploying through the Coolify API

The user provides a Coolify API token (never commit or echo it) and the admin URL `https://admin.shackyapps.in`.
Find apps by name with `GET /api/v1/applications` (names: `postiz-v2` = production, `postiz-v2-qat` = QAT). Then:

```
PATCH /api/v1/applications/{uuid}            {"docker_registry_image_tag": "v1.0.N-sociobird"}
POST  /api/v1/applications/{uuid}/start?force=false     -> {"deployment_uuid": "..."}
GET   /api/v1/deployments/{deployment_uuid}              -> poll the TOP-LEVEL "status": in_progress | finished | failed
GET   /api/v1/applications/{uuid}/logs?lines=3000       -> container logs
```

Pitfalls:
- Poll the **deployment's** `status`, not the application's. The application's `status` stays `running:unknown` and will fool a poll loop.
- A `finished` deployment only means the container started. **Verify the orchestrator** (next section).
- A pull can fail with `failed to extract layer ... overlayfs` (host containerd glitch). Nothing was started; just retry once.
- Coolify keeps the old container if a new one fails its health check. Health checks are currently **disabled** on both apps.
- Deploying restarts the worker: scheduled posts can be missed during the roughly 3 to 8 minutes it takes. Ask the user whether anything is due.

### Verify every deploy (production and QAT)

1. `GET .../logs` contains `Starting Nest application` and `Orchestrator health check listening`.
2. About 34 lines `Worker state changed ... taskQueue: '<q>' ... RUNNING`, including `main`.
3. Temporal app logs (`postiz-prod-temporal` / `postiz-qat-temporal`): `Started physicalTaskQueueManager` after the deploy time,
   and no `Stopped` for `main` or the app queues. (Idle provider queues unloading after a few minutes is normal.)
4. Site returns 200; the sidebar footer shows the image tag.
5. **Re-check after about 5 minutes.** Earlier bad images looked fine at first and the worker then went silent.

### Rollback

`PATCH docker_registry_image_tag` to the previous good tag, `POST .../start`, verify as above. Keep the previous tag in the log.

## Releasing the other repos

- **Docs:** edit `docs-site/sociobird/*.md` in `shackyapps-landing`, run `npm run build` in `docs-site` (catches broken links),
  PR, merge, then `POST /applications/{uuid}/start` for the `shackyapps-landing` Coolify app. Check `https://shackyapps.in/docs/sociobird/<page>/` (note trailing slash; the bare path 301s).
- **Marketing site:** PR + merge in `sociobird-site`, then start the `sociobird-site` app. Plan cards are hand-written HTML.
- **Mobile app:** PR to `master` in `SocioBirdMobile`; the "Build debug APK" workflow produces the artifact `sociobird-mobile-debug-apk`
  (also runnable with `workflow_dispatch` on any branch). The default branch is `master`; `develop` holds in-progress work.

## Testing against QAT

QAT (`social-qat.shackyapps.in`) has a test account; ask the user for credentials, never store them in the repo.
Headless Chromium + Playwright works in cloud sessions (`/opt/pw-browsers/chromium`), but through the session proxy you must
trust the proxy CA. A logged-in browser session can read the org API key from `GET /api/user/self` (`publicApi`) to exercise `/api/public/v1`.
Prefer tests that leave nothing behind (create, check, abort/delete). Production and QAT share one R2 bucket.

## Security hygiene

- This repo is public. No secrets, keys, IPs or internal URLs in code, docs or PR text.
- Tokens or passwords pasted into chat are compromised by definition: remind the user to rotate them.
- Do not weaken TLS or auth to get unblocked; stop and ask.
